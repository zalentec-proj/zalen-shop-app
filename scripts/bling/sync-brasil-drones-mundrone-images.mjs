import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true, override: false });

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'saida_bling');
const SOURCE_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_produtos.json');
const IMPORT_RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_resultado_importacao.json');
const COLLECTION_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_coleta.json');
const AUDIT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_auditoria.json');
const SUPABASE_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_supabase.json');
const DRY_RUN_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_bling_dry_run.json');
const RESULT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_resultado_bling.json');
const REPORT_FILE = path.join(OUTPUT_DIR, 'novo_catalogo_imagens_mundrone_relatorio.md');

const BLING_BASE_URL = 'https://api.bling.com.br/Api/v3';
const BLING_REFERENCE_URL = 'https://developer.bling.com.br/referencia';
const MUNDRONE_STORE_ID = '1317205';
const MUNDRONE_PRODUCT_URL = 'https://www.mundrone.com.br/loja/produto.php';
const MUNDRONE_SITEMAP_URL = 'https://www.mundrone.com.br/sitemap.xml';
const MODE = String(process.env.MUNDRONE_IMAGE_MODE ?? 'collect').toLowerCase();
const CONCURRENCY = positiveInteger(process.env.MUNDRONE_IMAGE_CONCURRENCY, 5);
const REQUEST_TIMEOUT_MS = positiveInteger(process.env.MUNDRONE_IMAGE_TIMEOUT_MS, 45_000);
const BLING_REQUEST_INTERVAL_MS = positiveInteger(process.env.BLING_REQUEST_INTERVAL_MS, 380);
const MAX_IMAGE_BYTES = positiveInteger(process.env.MUNDRONE_IMAGE_MAX_BYTES, 12 * 1024 * 1024);
const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET ?? 'product-images';
const STORAGE_PREFIX = process.env.SUPABASE_PRODUCT_IMAGES_PREFIX ?? 'bling/brasil-drones/catalogo-2026-08';
const UPDATE_APPROVED = process.env.BRASIL_DRONES_IMAGE_UPDATE_APPROVED === 'true';
const RETRY_FAILED_UPDATES = process.env.BRASIL_DRONES_IMAGE_RETRY_FAILED === 'true';

const SPECIAL_PRODUCT_MATCHES = {
  '589': {
    productId: '319',
    variantId: '149',
    url: 'https://www.mundrone.com.br/mini/mini-3/braco-completo-mini-3',
    reason: 'ID antigo foi reutilizado; variante pública Frente Direito validada manualmente.',
  },
  '593-MINI3-DE': {
    productId: '319',
    variantId: '147',
    url: 'https://www.mundrone.com.br/mini/mini-3/braco-completo-mini-3',
    reason: 'Código 593 duplicado na planilha; variante pública Frente Esquerdo validada manualmente.',
  },
};

const VARIANT_QUALIFIERS = new Set([
  'frente', 'traseiro', 'esquerdo', 'direito', 'superior', 'inferior', 'preto', 'branco', 'cinza', 'laranja',
  'vermelho', 'azul', 'motor', 'plus', 'normal', 'camera', 'cmos',
]);

const VALID_MODES = new Set(['collect', 'audit', 'upload', 'dry-run', 'update']);
if (!VALID_MODES.has(MODE)) {
  throw new Error(`MUNDRONE_IMAGE_MODE inválido: ${MODE}`);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

if (MODE === 'collect') await collectMundroneCatalog();
if (MODE === 'audit') await auditApprovedImages();
if (MODE === 'upload') await uploadApprovedImages();
if (MODE === 'dry-run') await createBlingDryRun();
if (MODE === 'update') await updateBlingImages();

async function collectMundroneCatalog() {
  const startedAt = new Date().toISOString();
  const source = await readJson(SOURCE_FILE);
  const products = source.products ?? [];
  if (products.length !== 599) {
    throw new Error(`Catálogo inesperado: ${products.length} produtos; esperado: 599.`);
  }
  const sitemapUrls = await loadMundroneSitemap();

  let completed = 0;
  const rows = await mapConcurrent(products, CONCURRENCY, async (product) => {
    const result = await collectProduct(product, sitemapUrls);
    completed += 1;
    if (completed % 20 === 0 || completed === products.length) {
      console.log(`[coleta] ${completed}/${products.length}`);
    }
    return result;
  });

  const summary = summarizeCollection(rows, startedAt);
  await writeJson(COLLECTION_FILE, { summary, rows });
  await writeReport({ collection: { summary, rows } });
  console.log(JSON.stringify(summary, null, 2));
}

async function collectProduct(product, sitemapUrls) {
  const special = SPECIAL_PRODUCT_MATCHES[String(product.code)];
  const requestedProductId = special?.productId ?? numericProductId(product.originalCode);
  if (!requestedProductId) {
    return collectionError(product, 'SEM_ID_MUNDRONE', 'Código não pode ser resolvido para um ID público do MundoDrone.');
  }

  const requestUrl = special?.url ?? buildMundroneProductUrl(requestedProductId);
  try {
    const { html, finalUrl, status } = await fetchHtml(requestUrl);
    if (status !== 200) return collectionError(product, 'ERRO_HTTP', `HTTP ${status}`, { requestUrl, finalUrl });

    const dataLayer = extractAssignedJson(html, 'dataLayer =');
    const pageData = Array.isArray(dataLayer)
      ? dataLayer.find((item) => String(item?.pageCategory ?? '').toLowerCase() === 'produto')
      : null;
    if (!pageData?.idProduct || !pageData?.nameProduct) {
      return collectProductByName(product, sitemapUrls, {
        status: 'PAGINA_NAO_ENCONTRADA',
        error: 'Página por ID não contém dados de produto.',
        requestUrl,
        finalUrl,
      });
    }

    const actualProductId = String(pageData.idProduct);
    if (actualProductId !== String(requestedProductId)) {
      return collectProductByName(product, sitemapUrls, {
        status: 'ID_DIVERGENTE',
        error: `Esperado ${requestedProductId}; página retornou ${actualProductId}.`,
        requestUrl,
        finalUrl,
      });
    }

    const variants = extractAssignedJson(html, 'var variantsCor =') ?? [];
    const variant = selectVariant(product, variants, special?.variantId);
    const candidateLabel = `${pageData.nameProduct} ${variantLabel(variant)}`;
    if (!catalogIdentityCompatible(product, `${finalUrl} ${candidateLabel}`, candidateLabel)) {
      return collectProductByName(product, sitemapUrls, {
        status: 'CONTEUDO_ID_DIVERGENTE',
        error: `O ID ${requestedProductId} aponta para outro produto no catálogo atual.`,
        requestUrl,
        finalUrl,
      });
    }
    return buildCollectedProduct(product, {
      html,
      pageData,
      variant,
      requestUrl,
      finalUrl,
      status: special ? 'MATCH_ESPECIAL_VARIANTE' : 'MATCH_EXATO_ID',
      matchMethod: special ? 'OVERRIDE_AUDITADO' : 'ID_PRODUCT_EXATO',
      matchReason: special?.reason ?? null,
    });
  } catch (error) {
    return collectionError(product, 'ERRO_COLETA', safeError(error), { requestUrl });
  }
}

async function collectProductByName(product, sitemapUrls, originalFailure) {
  const ranked = sitemapUrls
    .map((url) => ({ url, score: urlCandidateScore(product, url), modelCompatible: modelCompatible(product, url) }))
    .filter((candidate) => candidate.modelCompatible && candidate.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  const reviewed = [];
  for (const candidate of ranked) {
    try {
      const { html, finalUrl, status } = await fetchHtml(candidate.url);
      if (status !== 200) continue;
      const dataLayer = extractAssignedJson(html, 'dataLayer =');
      const pageData = Array.isArray(dataLayer)
        ? dataLayer.find((item) => String(item?.pageCategory ?? '').toLowerCase() === 'produto')
        : null;
      if (!pageData?.idProduct || !pageData?.nameProduct) continue;
      const variants = extractAssignedJson(html, 'var variantsCor =') ?? [];
      const variant = selectVariant(product, variants);
      const candidateLabel = `${pageData.nameProduct} ${variantLabel(variant)}`;
      const nameSimilarity = tokenSimilarity(product.name, candidateLabel);
      const compatible = catalogIdentityCompatible(product, `${candidate.url} ${candidateLabel}`, candidateLabel);
      reviewed.push({
        url: candidate.url,
        productId: String(pageData.idProduct),
        name: pageData.nameProduct,
        variantId: variant?.id ? String(variant.id) : null,
        variantName: variant?.nameSku ?? null,
        score: nameSimilarity,
        compatible,
      });
      if (!compatible || nameSimilarity < 0.65) continue;
      return buildCollectedProduct(product, {
        html,
        pageData,
        variant,
        requestUrl: candidate.url,
        finalUrl,
        status: 'MATCH_NOME_AUDITAVEL',
        matchMethod: 'NOME_MODELO_POSICAO',
        matchReason: `ID original indisponível; nome/modelo/posição compatíveis com similaridade ${nameSimilarity}.`,
        alerts: [`ID original ${product.originalCode} não existe no site atual; correspondência por nome auditável.`],
      });
    } catch (error) {
      reviewed.push({ url: candidate.url, error: safeError(error), compatible: false });
    }
  }
  return collectionError(product, originalFailure.status, originalFailure.error, {
    requestUrl: originalFailure.requestUrl,
    finalUrl: originalFailure.finalUrl,
    fallbackCandidatesReviewed: reviewed,
  });
}

function buildCollectedProduct(product, options) {
  const parentImages = extractParentGallery(options.html);
  const variantImages = extractVariantImages(options.variant);
  const selectedImages = dedupe(variantImages.length ? variantImages : parentImages).filter(isAllowedTrayProductImage);
  const canonicalUrl = extractCanonicalUrl(options.html)
    ?? String(options.pageData.urlProduct ?? '').replace(/^http:/, 'https:')
    ?? options.finalUrl;
  const expectedImages = expectedImageCount(product);
  if (!selectedImages.length) {
    return collectionError(product, 'SEM_IMAGEM_NA_PAGINA', 'Nenhuma imagem válida encontrada na galeria do produto.', {
      requestUrl: options.requestUrl,
      finalUrl: options.finalUrl,
      sourcePage: canonicalUrl,
      mundroneProductId: String(options.pageData.idProduct),
      mundroneName: options.pageData.nameProduct,
    });
  }
  const alerts = [...(options.alerts ?? [])];
  if (expectedImages > 0 && expectedImages !== selectedImages.length) {
    alerts.push(`Quantidade da galeria atual (${selectedImages.length}) difere da planilha (${expectedImages}).`);
  }
  return {
    code: String(product.code),
    originalCode: String(product.originalCode ?? ''),
    name: product.name,
    blingCategoryPath: product.categoryPath,
    sourceSheet: product.sourceSheet,
    sourceRow: product.sourceRow,
    status: options.status,
    matchMethod: options.matchMethod,
    matchReason: options.matchReason,
    requestUrl: options.requestUrl,
    sourcePage: canonicalUrl,
    sourceDomain: 'mundrone.com.br',
    mundroneProductId: String(options.pageData.idProduct),
    mundroneName: options.pageData.nameProduct,
    mundroneReference: options.pageData.reference ?? null,
    mundroneEan: options.pageData.EAN ?? null,
    selectedVariantId: options.variant?.id ? String(options.variant.id) : null,
    selectedVariantName: variantLabel(options.variant) || null,
    nameSimilarity: tokenSimilarity(product.name, `${options.pageData.nameProduct} ${variantLabel(options.variant)}`),
    expectedImagesFromWorkbook: expectedImages,
    imageCount: selectedImages.length,
    images: selectedImages.map((url, index) => ({
      order: index + 1,
      role: index === 0 ? 'PRINCIPAL' : 'ADICIONAL',
      sourceUrl: url,
    })),
    alerts,
  };
}

async function uploadApprovedImages() {
  const startedAt = new Date().toISOString();
  const collection = await readJson(COLLECTION_FILE);
  const rows = collection.rows ?? [];
  const eligible = rows.filter((row) => String(row.status).startsWith('MATCH_'));
  const uploader = await createStorageUploader();

  let completed = 0;
  const uploadedRows = await mapConcurrent(eligible, CONCURRENCY, async (row) => {
    const result = await processProductImagesForUpload(uploader, row);
    completed += 1;
    if (completed % 20 === 0 || completed === eligible.length) {
      console.log(`[supabase] ${completed}/${eligible.length}`);
    }
    return result;
  });

  const summary = summarizeUploads(uploadedRows, rows.length, startedAt);
  await writeJson(SUPABASE_FILE, { summary, rows: uploadedRows });
  await writeReport({ collection, uploads: { summary, rows: uploadedRows } });
  console.log(JSON.stringify(summary, null, 2));
}

async function auditApprovedImages() {
  const startedAt = new Date().toISOString();
  const collection = await readJson(COLLECTION_FILE);
  const eligible = (collection.rows ?? []).filter((row) => String(row.status).startsWith('MATCH_'));
  let completed = 0;
  const rows = await mapConcurrent(eligible, CONCURRENCY, async (row) => {
    const inspected = await inspectProductImages(row);
    completed += 1;
    if (completed % 20 === 0 || completed === eligible.length) {
      console.log(`[auditoria] ${completed}/${eligible.length}`);
    }
    const principal = inspected.find((image) => image.order === 1);
    return {
      ...collectionIdentity(row),
      sourcePage: row.sourcePage,
      status: principal?.valid ? 'APROVADO' : 'BLOQUEADO_PRINCIPAL_INVALIDA',
      validImageCount: inspected.filter((image) => image.valid).length,
      rejectedImageCount: inspected.filter((image) => !image.valid).length,
      images: inspected.map(publicInspection),
    };
  });
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    auditedProducts: rows.length,
    approvedProducts: rows.filter((row) => row.status === 'APROVADO').length,
    blockedProducts: rows.filter((row) => row.status !== 'APROVADO').length,
    validImages: rows.reduce((total, row) => total + row.validImageCount, 0),
    rejectedImages: rows.reduce((total, row) => total + row.rejectedImageCount, 0),
  };
  await writeJson(AUDIT_FILE, { summary, rows });
  console.log(JSON.stringify(summary, null, 2));
}

async function processProductImagesForUpload(uploader, row) {
  const inspected = await inspectProductImages(row);

  const principal = inspected.find((image) => image.order === 1);
  if (!principal?.valid) {
    return {
      ...collectionIdentity(row),
      sourcePage: row.sourcePage,
      status: 'BLOQUEADO_PRINCIPAL_INVALIDA',
      images: inspected.map(publicInspection),
      error: `Imagem principal reprovada: ${(principal?.warnings ?? ['não encontrada']).join(', ')}`,
    };
  }

  const validImages = inspected.filter((image) => image.valid);
  const uploads = [];
  for (const image of validImages) {
    try {
      const extension = extensionFor(image.contentType, image.visual?.format, image.sourceUrl);
      const digest = createHash('sha256').update(image.buffer).digest('hex');
      const objectPath = `${STORAGE_PREFIX}/${safePath(row.code)}/${String(image.order).padStart(2, '0')}-${digest.slice(0, 16)}.${extension}`;
      const publicUrl = await uploadStorageImage(uploader, {
        objectPath,
        sourceUrl: image.sourceUrl,
        expectedSha256: digest,
        contentType: image.contentType,
        buffer: image.buffer,
      });
      await verifyPublicImageUrl(publicUrl);
      uploads.push({
        order: uploads.length + 1,
        sourceOrder: image.order,
        role: uploads.length === 0 ? 'PRINCIPAL' : 'ADICIONAL',
        sourceUrl: image.sourceUrl,
        supabaseBucket: BUCKET,
        supabasePath: objectPath,
        supabasePublicUrl: publicUrl,
        sha256: digest,
        contentType: image.contentType,
        bytes: image.buffer.length,
        width: image.visual.width,
        height: image.visual.height,
        meanBrightness: image.visual.meanBrightness,
        stdBrightness: image.visual.stdBrightness,
        warnings: image.warnings,
      });
    } catch (error) {
      return {
        ...collectionIdentity(row),
        sourcePage: row.sourcePage,
        status: 'ERRO_UPLOAD',
        images: uploads,
        error: safeError(error),
      };
    }
  }

  return {
    ...collectionIdentity(row),
    sourcePage: row.sourcePage,
    status: 'COPIADO_SUPABASE',
    sourceImageCount: inspected.length,
    validImageCount: validImages.length,
    rejectedAdditionalImages: inspected.filter((image) => image.order !== 1 && !image.valid).map(publicInspection),
    images: uploads,
  };
}

async function inspectProductImages(row) {
  const inspected = [];
  for (const image of row.images ?? []) {
    try {
      const downloaded = await downloadImage(image.sourceUrl, row.sourcePage);
      const visual = await analyzeImage(downloaded.buffer);
      const problems = visualProblemsFor(visual);
      const warnings = [...problems, ...visualWarningsFor(visual)];
      inspected.push({ ...image, ...downloaded, visual, warnings, valid: problems.length === 0 });
    } catch (error) {
      inspected.push({ ...image, valid: false, warnings: [safeError(error)] });
    }
  }
  return inspected;
}

async function createBlingDryRun() {
  const plan = await buildBlingPlan();
  const openApi = await loadAndValidateBlingOpenApi();
  const document = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    approved: false,
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    openApi,
    summary: summarizePlan(plan),
    updates: plan,
  };
  await writeJson(DRY_RUN_FILE, document);
  const collection = await readJson(COLLECTION_FILE);
  const uploads = await readJson(SUPABASE_FILE);
  const result = existsSync(RESULT_FILE) ? await readJson(RESULT_FILE) : null;
  await writeReport({ collection, uploads, dryRun: document, result });
  console.log(JSON.stringify(document.summary, null, 2));
}

async function updateBlingImages() {
  if (!UPDATE_APPROVED) {
    throw new Error('Atualização bloqueada: defina BRASIL_DRONES_IMAGE_UPDATE_APPROVED=true.');
  }
  const startedAt = new Date().toISOString();
  const fullPlan = await buildBlingPlan();
  const previousResult = RETRY_FAILED_UPDATES && existsSync(RESULT_FILE) ? await readJson(RESULT_FILE) : null;
  const failedKeys = new Set(
    (previousResult?.updates ?? [])
      .filter((item) => item.status === 'ERRO_API')
      .map((item) => `${item.code}:${item.blingId}`)
  );
  const plan = RETRY_FAILED_UPDATES
    ? fullPlan.filter((item) => failedKeys.has(`${item.code}:${item.blingId}`))
    : fullPlan;
  if (RETRY_FAILED_UPDATES && !plan.length) {
    throw new Error('Retomada solicitada, mas não há falhas de API pendentes no resultado anterior.');
  }
  const openApi = await loadAndValidateBlingOpenApi();
  const accessToken = await loadAccessToken();
  const updates = [];

  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index];
    try {
      const before = await requestBling('GET', `/produtos/${item.blingId}`, accessToken);
      const currentUrls = extractBlingExternalImages(before?.data ?? before);
      if (sameUrls(currentUrls, item.supabasePublicUrls)) {
        updates.push({ ...item, status: 'JA_ATUALIZADO', currentUrls });
      } else {
        const patchResult = await requestBling('PATCH', `/produtos/${item.blingId}`, accessToken, {
          body: {
            midia: {
              imagens: {
                imagensURL: item.supabasePublicUrls.map((link) => ({ link })),
              },
            },
          },
        });
        const after = await requestBling('GET', `/produtos/${item.blingId}`, accessToken);
        const verification = verifyBlingImages(after?.data ?? after, item.supabasePublicUrls);
        updates.push({
          ...item,
          status: verification.ok ? 'ATUALIZADO_VERIFICADO' : 'ATUALIZADO_ACEITO_API',
          patchResult,
          verification,
        });
      }
    } catch (error) {
      updates.push({ ...item, status: 'ERRO_API', error: safeError(error) });
    }
    if ((index + 1) % 20 === 0 || index + 1 === plan.length) {
      console.log(`[bling] ${index + 1}/${plan.length}`);
    }
    await sleep(BLING_REQUEST_INTERVAL_MS);
  }

  const mergedUpdates = mergeUpdateResults(previousResult?.updates ?? [], updates);
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    plannedProducts: fullPlan.length,
    plannedImages: fullPlan.reduce((total, item) => total + item.supabasePublicUrls.length, 0),
    processedThisRun: plan.length,
    acceptedByApi: mergedUpdates.filter((item) => item.status === 'ATUALIZADO_ACEITO_API').length,
    updatedAndVerified: mergedUpdates.filter((item) => item.status === 'ATUALIZADO_VERIFICADO').length,
    alreadyUpdated: mergedUpdates.filter((item) => item.status === 'JA_ATUALIZADO').length,
    errors: mergedUpdates.filter((item) => item.status === 'ERRO_API').length,
  };
  const result = {
    status: summary.errors ? 'completed_with_errors' : 'completed',
    credentialsPolicy: 'BLING_CUSTOMER_* only',
    openApi,
    verificationPolicy: 'imagensURL is writeOnly; PATCH 200 is accepted, with visual sampling in Bling UI',
    summary,
    updates: mergedUpdates,
  };
  await writeJson(RESULT_FILE, result);
  const collection = await readJson(COLLECTION_FILE);
  const uploads = await readJson(SUPABASE_FILE);
  const dryRun = existsSync(DRY_RUN_FILE) ? await readJson(DRY_RUN_FILE) : null;
  await writeReport({ collection, uploads, dryRun, result });
  console.log(JSON.stringify(summary, null, 2));
}

function mergeUpdateResults(previousUpdates, currentUpdates) {
  const normalizedPrevious = previousUpdates.map((item) => item.status === 'ATUALIZADO_NAO_CONFIRMADO'
    ? {
        ...item,
        status: 'ATUALIZADO_ACEITO_API',
        verification: {
          ...item.verification,
          note: 'imagensURL é writeOnly no OpenAPI; confirmação feita por PATCH 200 e amostragem visual.',
        },
      }
    : item);
  if (!normalizedPrevious.length) return currentUpdates;
  const merged = new Map(normalizedPrevious.map((item) => [`${item.code}:${item.blingId}`, item]));
  for (const item of currentUpdates) merged.set(`${item.code}:${item.blingId}`, item);
  return [...merged.values()].sort((a, b) => String(a.code).localeCompare(String(b.code), 'pt-BR', { numeric: true }));
}

async function buildBlingPlan() {
  const source = await readJson(SOURCE_FILE);
  const importResult = await readJson(IMPORT_RESULT_FILE);
  const uploads = await readJson(SUPABASE_FILE);
  const sourceByCode = new Map((source.products ?? []).map((item) => [String(item.code), item]));
  const blingIds = new Map(
    [...(importResult.created ?? []), ...(importResult.existing ?? [])]
      .filter((item) => item.code != null && item.id != null)
      .map((item) => [String(item.code), Number(item.id)])
  );

  const plan = [];
  for (const upload of uploads.rows ?? []) {
    if (upload.status !== 'COPIADO_SUPABASE' || !upload.images?.length) continue;
    const code = String(upload.code);
    const sourceProduct = sourceByCode.get(code);
    const blingId = blingIds.get(code);
    if (!sourceProduct) throw new Error(`SKU ${code} não existe no catálogo-fonte.`);
    if (!blingId) throw new Error(`SKU ${code} não possui ID no resultado da importação Bling.`);
    const ordered = [...upload.images].sort((a, b) => Number(a.order) - Number(b.order));
    const urls = ordered.map((item) => item.supabasePublicUrl).filter(Boolean);
    if (!urls.length || new Set(urls).size !== urls.length) {
      throw new Error(`Galeria inválida ou duplicada para SKU ${code}.`);
    }
    plan.push({
      code,
      name: sourceProduct.name,
      blingId,
      sourcePage: upload.sourcePage,
      sourceDomain: 'mundrone.com.br',
      imageCount: urls.length,
      mainImage: urls[0],
      supabasePublicUrls: urls,
      payload: {
        midia: {
          imagens: {
            imagensURL: urls.map((link) => ({ link })),
          },
        },
      },
    });
  }
  return plan.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
}

async function loadAndValidateBlingOpenApi() {
  const referenceResponse = await fetchWithRetry(BLING_REFERENCE_URL, {
    headers: browserHeaders('text/html'),
  });
  const referenceHtml = await referenceResponse.text();
  const referenceAsset = referenceHtml.match(/build\/assets\/reference-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!referenceAsset) throw new Error('Asset da referência oficial do Bling não encontrado.');
  const referenceAssetUrl = new URL(referenceAsset, BLING_REFERENCE_URL).href;
  const jsResponse = await fetchWithRetry(referenceAssetUrl, { headers: browserHeaders('text/javascript') });
  const js = await jsResponse.text();
  const openApiAsset = js.match(/openapi-[A-Za-z0-9_-]+\.json/)?.[0];
  if (!openApiAsset) throw new Error('OpenAPI oficial do Bling não encontrado no asset atual.');
  const openApiUrl = new URL(`/build/assets/${openApiAsset}`, BLING_REFERENCE_URL).href;
  const openApiResponse = await fetchWithRetry(openApiUrl, { headers: browserHeaders('application/json') });
  const openApi = await openApiResponse.json();

  const patchSchema = openApi.paths?.['/produtos/{idProduto}']?.patch?.requestBody?.content?.['application/json']?.schema;
  const flattened = flattenSchema(openApi, patchSchema);
  const midia = flattenSchema(openApi, flattened.properties?.midia);
  const imagens = flattenSchema(openApi, midia.properties?.imagens);
  const imagensUrl = flattenSchema(openApi, imagens.properties?.imagensURL);
  const imageItem = flattenSchema(openApi, imagensUrl.items);
  if (imagensUrl.type !== 'array' || imageItem.properties?.link?.type !== 'string') {
    throw new Error('Schema do Bling divergiu: midia.imagens.imagensURL[].link não está disponível.');
  }
  return {
    referenceUrl: BLING_REFERENCE_URL,
    openApiUrl,
    version: openApi.info?.version,
    patchSchema: patchSchema?.$ref?.split('/').at(-1) ?? 'inline',
    imageField: 'midia.imagens.imagensURL[].link',
  };
}

function flattenSchema(openApi, schema, seen = new Set()) {
  if (!schema) return { properties: {} };
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return { properties: {} };
    const nextSeen = new Set(seen).add(schema.$ref);
    return flattenSchema(openApi, resolveRef(openApi, schema.$ref), nextSeen);
  }
  const result = { ...schema, properties: { ...(schema.properties ?? {}) } };
  for (const part of schema.allOf ?? []) {
    const flat = flattenSchema(openApi, part, seen);
    Object.assign(result.properties, flat.properties ?? {});
  }
  return result;
}

function resolveRef(document, reference) {
  return reference.split('/').slice(1).reduce((value, key) => value?.[key], document);
}

async function loadAccessToken() {
  if (process.env.BLING_CUSTOMER_ACCESS_TOKEN) return process.env.BLING_CUSTOMER_ACCESS_TOKEN;
  const code = requiredEnv('BLING_AUTH_CODE');
  const clientId = requiredEnv('BLING_CUSTOMER_CLIENT_ID');
  const clientSecret = requiredEnv('BLING_CUSTOMER_CLIENT_SECRET');
  const response = await fetchWithRetry(`${BLING_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: '1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  const body = await response.json().catch(() => ({}));
  if (!body.access_token) throw new Error(`Troca OAuth Bling falhou: ${extractBlingError(body)}`);
  return body.access_token;
}

async function requestBling(method, endpoint, accessToken, options = {}) {
  const response = await fetchWithRetry(`${BLING_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'enable-jwt': '1',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${extractBlingError(body)}`);
  return body;
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
      const retryAfter = Number(response.headers.get('retry-after') ?? 0) * 1000;
      await sleep(Math.max(retryAfter, attempt * 900));
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 900);
    }
  }
  throw lastError ?? new Error('Falha de rede sem detalhe.');
}

async function fetchHtml(url) {
  const response = await fetchWithRetry(url, { headers: browserHeaders('text/html,application/xhtml+xml') });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    html: buffer.toString('latin1'),
    finalUrl: response.url,
    status: response.status,
  };
}

async function loadMundroneSitemap() {
  const indexResponse = await fetchWithRetry(MUNDRONE_SITEMAP_URL, { headers: browserHeaders('application/xml,text/xml') });
  if (!indexResponse.ok) throw new Error(`Sitemap MundoDrone indisponível: HTTP ${indexResponse.status}.`);
  const indexXml = await indexResponse.text();
  const childSitemaps = extractSitemapLocations(indexXml).filter((url) => /\.xml(?:$|\?)/i.test(url));
  const urls = [];
  if (!childSitemaps.length) urls.push(...extractSitemapLocations(indexXml));
  for (const childUrl of childSitemaps) {
    const response = await fetchWithRetry(childUrl, { headers: browserHeaders('application/xml,text/xml') });
    if (!response.ok) throw new Error(`Sitemap filho indisponível: HTTP ${response.status}.`);
    urls.push(...extractSitemapLocations(await response.text()));
  }
  const productUrls = dedupe(urls).filter((value) => {
    try {
      const url = new URL(value);
      return url.hostname === 'www.mundrone.com.br' && url.pathname.split('/').filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  });
  if (productUrls.length < 500) throw new Error(`Sitemap MundoDrone inesperado: ${productUrls.length} URLs.`);
  return productUrls;
}

function extractSitemapLocations(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decodeHtml(match[1].trim()));
}

async function downloadImage(url, referer) {
  const response = await fetchWithRetry(url, {
    headers: {
      ...browserHeaders('image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8'),
      Referer: referer,
    },
  });
  if (!response.ok) throw new Error(`download_http_${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('imagem_vazia');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`imagem_maior_que_limite:${buffer.length}`);
  const contentType = String(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error(`content_type_invalido:${contentType || 'unknown'}`);
  return { buffer, contentType };
}

async function analyzeImage(buffer) {
  const image = sharp(buffer, { limitInputPixels: false });
  const metadata = await image.metadata();
  const resized = await image
    .flatten({ background: '#ffffff' })
    .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sum2 = 0;
  for (let index = 0; index < resized.data.length; index += 3) {
    const luminance = 0.2126 * resized.data[index] + 0.7152 * resized.data[index + 1] + 0.0722 * resized.data[index + 2];
    sum += luminance;
    sum2 += luminance * luminance;
  }
  const pixels = resized.data.length / 3;
  const mean = sum / pixels;
  const deviation = Math.sqrt(Math.max(0, sum2 / pixels - mean * mean));
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? null,
    meanBrightness: Number(mean.toFixed(1)),
    stdBrightness: Number(deviation.toFixed(1)),
  };
}

function visualProblemsFor(visual) {
  const problems = [];
  if (!visual.width || !visual.height) return ['DIMENSAO_NAO_LIDA'];
  if (Math.max(visual.width, visual.height) < 500 || Math.min(visual.width, visual.height) < 120) {
    problems.push('MUITO_PEQUENA');
  }
  if (visual.meanBrightness < 22 && visual.stdBrightness < 24) problems.push('MUITO_ESCURA_PRETA');
  if (visual.stdBrightness < 7) problems.push('BAIXA_VARIACAO_VISUAL');
  return problems;
}

function visualWarningsFor(visual) {
  if (!visual.width || !visual.height) return [];
  const ratio = Math.max(visual.width / visual.height, visual.height / visual.width);
  return ratio > 2.2 ? ['ASPECTO_EXTREMO_REVISAR_ENQUADRAMENTO'] : [];
}

async function ensurePublicBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const bucket = buckets.find((item) => item.name === BUCKET || item.id === BUCKET);
  if (!bucket) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      fileSizeLimit: MAX_IMAGE_BYTES,
    });
    if (createError) throw createError;
    return;
  }
  if (!bucket.public) {
    throw new Error(`O bucket ${BUCKET} existe, mas não é público; nenhuma permissão foi alterada automaticamente.`);
  }
}

async function createStorageUploader() {
  const edgeUrl = process.env.SUPABASE_IMAGE_IMPORT_URL;
  const edgeToken = process.env.SUPABASE_IMAGE_IMPORT_TOKEN;
  if (edgeUrl || edgeToken) {
    if (!edgeUrl || !edgeToken) throw new Error('Upload temporário exige URL e token da função Supabase.');
    return { type: 'edge', edgeUrl, edgeToken };
  }
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? requiredEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecret, { auth: { persistSession: false } });
  await ensurePublicBucket(supabase);
  return { type: 'direct', supabase };
}

async function uploadStorageImage(uploader, image) {
  if (uploader.type === 'edge') {
    const response = await fetchWithRetry(uploader.edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-import-token': uploader.edgeToken,
      },
      body: JSON.stringify({
        objectPath: image.objectPath,
        sourceUrl: image.sourceUrl,
        expectedSha256: image.expectedSha256,
        contentType: image.contentType,
        imageBase64: image.buffer.toString('base64'),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.publicUrl) {
      throw new Error(`Upload temporário falhou: HTTP ${response.status}: ${body.error ?? 'resposta inválida'}`);
    }
    return body.publicUrl;
  }
  const { error: uploadError } = await uploader.supabase.storage.from(BUCKET).upload(image.objectPath, image.buffer, {
    contentType: image.contentType,
    cacheControl: '31536000',
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { data } = uploader.supabase.storage.from(BUCKET).getPublicUrl(image.objectPath);
  if (!data?.publicUrl) throw new Error('Supabase não retornou URL pública.');
  return data.publicUrl;
}

async function verifyPublicImageUrl(url) {
  const response = await fetchWithRetry(url, { method: 'HEAD' });
  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(`URL pública não validada: HTTP ${response.status}, content-type ${contentType || 'ausente'}.`);
  }
}

function extractAssignedJson(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('[', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractParentGallery(html) {
  const start = html.indexOf('<div class="gallery-modal-content">');
  const end = html.indexOf('<div class="product-images', start);
  if (start >= 0 && end > start) {
    return extractImageAttributes(html.slice(start, end), 'src');
  }
  const fallbackStart = html.indexOf('<div class="product-images');
  const fallbackEnd = html.indexOf('<ul class="product-thumbs', fallbackStart);
  if (fallbackStart >= 0 && fallbackEnd > fallbackStart) {
    return extractImageAttributes(html.slice(fallbackStart, fallbackEnd), 'data-src');
  }
  return [];
}

function extractImageAttributes(fragment, attribute) {
  const values = [];
  const regex = new RegExp(`${attribute}=["']([^"']+)["']`, 'gi');
  let match;
  while ((match = regex.exec(fragment))) values.push(decodeHtml(match[1]));
  return dedupe(values);
}

function extractVariantImages(variant) {
  if (!variant?.images || !Array.isArray(variant.images)) return [];
  return variant.images.map((item) => item?.full).filter(Boolean);
}

function selectVariant(product, variants, requiredVariantId) {
  if (!Array.isArray(variants) || !variants.length) return null;
  if (requiredVariantId) return variants.find((item) => String(item.id) === String(requiredVariantId)) ?? null;
  const source = normalizedWords(product.name);
  const sourceSet = new Set(source);
  const candidates = variants
    .map((variant) => {
      const label = variantLabel(variant);
      const terms = normalizedWords(label).filter((term) => !['lado', 'cor', 'modelo', 'tamanho'].includes(term));
      const qualifierTerms = terms.filter((term) => VARIANT_QUALIFIERS.has(term));
      const matched = terms.filter((term) => sourceSet.has(term)).length;
      const score = terms.length ? matched / terms.length : 0;
      return { variant, terms, qualifierTerms, score };
    })
    .filter((item) => item.terms.length && item.qualifierTerms.length && item.score === 1)
    .sort((a, b) => b.terms.length - a.terms.length);
  if (!candidates.length) return null;
  if (candidates[1] && candidates[1].terms.length === candidates[0].terms.length) return null;
  return candidates[0].variant;
}

function variantLabel(variant) {
  if (!variant) return '';
  return variant.nameSku
    ?? variant.Sku?.map((item) => `${item.type}: ${item.value}`).join(' / ')
    ?? '';
}

function normalizedWords(value) {
  return normalize(value)
    .replace(/\bdianteir[oa]\b/g, 'frente')
    .replace(/\bfrontal\b/g, 'frente')
    .replace(/\bdireita\b/g, 'direito')
    .replace(/\besquerda\b/g, 'esquerdo')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSimilarity(left, right) {
  const leftSet = new Set(normalizedWords(left).filter(isMeaningfulToken));
  const rightSet = new Set(normalizedWords(right).filter(isMeaningfulToken));
  if (!leftSet.size || !rightSet.size) return 0;
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  return Number(((2 * intersection) / (leftSet.size + rightSet.size)).toFixed(3));
}

function urlCandidateScore(product, value) {
  const url = new URL(value);
  const pathname = decodeURIComponent(url.pathname.replace(/[-_/]+/g, ' '));
  const nameScore = tokenSimilarity(product.name, pathname);
  const categoryScore = tokenSimilarity(`${product.sourceSheet} ${product.categoryPath}`, pathname);
  const positionBonus = positionCompatible(product.name, pathname) ? 0.08 : -0.2;
  return Number((nameScore * 0.78 + categoryScore * 0.22 + positionBonus).toFixed(4));
}

function modelCompatible(product, candidate) {
  const families = ['mini', 'air', 'mavic', 'avata', 'phantom', 'neo', 'lito', 'flip', 'fpv'];
  const productName = normalize(product.name);
  const productTokens = normalizedWords(productName);
  const genericAccessory = !families.some((family) => productTokens.includes(family))
    && productTokens.some((term) => ['controle', 'radio', 'cabo', 'alca', 'pelicula', 'botao', 'stick'].includes(term));
  const sourceText = families.some((family) => productTokens.includes(family)) || genericAccessory
    ? productName
    : `${product.sourceSheet} ${product.categoryPath}`;
  const sourceTokens = normalizedWords(sourceText);
  const candidateTokens = normalizedWords(candidate);
  const activeFamilies = families
    .filter((family) => sourceTokens.includes(family))
    .filter((family) => !(family === 'mavic' && sourceTokens.includes('air')));
  if (!activeFamilies.length) return true;
  for (const family of activeFamilies) {
    if (!candidateTokens.includes(family)) return false;
    const sourceModels = modelTokensNearFamily(sourceTokens, family);
    const candidateModels = modelTokensNearFamily(candidateTokens, family);
    if (sourceModels.size && candidateModels.size) {
      const overlap = [...sourceModels].some((model) => candidateModels.has(model));
      if (!overlap) return false;
    } else if (sourceModels.size !== candidateModels.size && ['mini', 'air', 'mavic', 'avata', 'phantom', 'neo'].includes(family)) {
      return false;
    }
  }
  return true;
}

function modelTokensNearFamily(tokens, family) {
  const models = new Set();
  const families = new Set(['mini', 'air', 'mavic', 'avata', 'phantom', 'neo', 'lito', 'flip', 'fpv']);
  const suffixes = new Set(['pro', 'se', 'cine', 'classic', 'zoom']);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== family) continue;
    const nearby = [];
    for (const token of tokens.slice(index + 1, index + 5)) {
      if (families.has(token)) break;
      nearby.push(token);
    }
    const baseIndex = nearby.findIndex((token) => /^(?:\d+[a-z]?|pro|se)$/.test(token));
    if (baseIndex < 0) continue;
    const base = nearby[baseIndex];
    if (/^\d+[a-z]?$/.test(base)) {
      const suffix = nearby[baseIndex + 1];
      models.add(suffixes.has(suffix) ? `${base}${suffix}` : base);
    } else {
      models.add(base);
    }
  }
  return models;
}

function positionCompatible(sourceName, candidateName) {
  const positional = ['frente', 'traseiro', 'esquerdo', 'direito', 'superior', 'inferior'];
  const sourceTerms = new Set(normalizedWords(sourceName));
  const candidateTerms = new Set(normalizedWords(candidateName));
  const required = positional.filter((term) => sourceTerms.has(term));
  return required.every((term) => candidateTerms.has(term));
}

function semanticCompatible(sourceName, candidateName) {
  const source = normalize(sourceName);
  const candidate = normalize(candidateName);
  const sourceKind = componentKind(source);
  const candidateKind = componentKind(candidate);
  if (sourceKind && candidateKind && sourceKind !== candidateKind) return false;
  if (/\bcompleto\b/.test(source)) {
    const missingPart = candidate.match(/\bsem (motor|fiacao|camera|cmos)\b/)?.[1];
    if (missingPart && !new RegExp(`\\bsem ${missingPart}\\b`).test(source)) return false;
  }
  if (/\bcom motor\b/.test(source) && /\bsem motor\b/.test(candidate)) return false;
  if (/\bcmos\b/.test(source) && !/\bsem cmos\b/.test(source) && !/\b(camera|cmos)\b/.test(candidate)) return false;
  if (/\bcom camera\b/.test(source) && !/\b(camera|cmos)\b/.test(candidate)) return false;
  if (/\boriginal\b/.test(source) && /\b(paralel[oa]|compativel)\b/.test(candidate)) return false;
  if (/\b(paralel[oa]|compativel)\b/.test(source) && /\boriginal\b/.test(candidate)) return false;
  return true;
}

function catalogIdentityCompatible(product, candidateWithContext, candidateName) {
  return modelCompatible(product, candidateWithContext)
    && positionCompatible(product.name, candidateName)
    && semanticCompatible(product.name, candidateName);
}

function componentKind(value) {
  const groups = [
    ['eixo', /\beixo\b/],
    ['tampa', /\b(tampa|cover|protetor|acabamento|limitador)\b/],
    ['carcaca', /\b(carcaca|shell|frame)\b/],
    ['cabo', /\b(cabo|flat)\b/],
    ['placa', /\b(placa|core|board|esc|controladora)\b/],
    ['controle', /\b(controle|radio|rc\d*)\b/],
    ['sensor', /\b(sensor|imu|gps|vision|visao)\b/],
    ['helice', /\b(helice|rotor|propeller)\b/],
    ['gimbal', /\b(gimbal|ptz)\b/],
    ['camera', /\b(camera|cmos)\b/],
    ['bateria', /\b(bateria|battery)\b/],
    ['carregador', /\b(carregador|charger|hub)\b/],
    ['motor', /\bmotor\b/],
    ['drone', /\bdrone\b/],
    ['braco', /\b(braco|arm)\b/],
  ];
  return groups.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

function isMeaningfulToken(token) {
  return token.length > 1 && !['dji', 'para', 'com', 'sem', 'do', 'da', 'de', 'e', 'o', 'a'].includes(token);
}

function extractCanonicalUrl(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match ? decodeHtml(match[1]).replace(/^http:/, 'https:') : null;
}

function isAllowedTrayProductImage(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'images.tcdn.com.br') return false;
    if (!parsed.pathname.includes(`/img/img_prod/${MUNDRONE_STORE_ID}/`)) return false;
    return !/(logo|banner|favicon|sprite|empty|sem[_-]?foto|placeholder)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function buildMundroneProductUrl(productId) {
  const url = new URL(MUNDRONE_PRODUCT_URL);
  url.searchParams.set('loja', MUNDRONE_STORE_ID);
  url.searchParams.set('IdProd', productId);
  return url.href;
}

function numericProductId(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  return String(Number(text));
}

function expectedImageCount(product) {
  const main = product.mainImage ? 1 : 0;
  const additional = String(product.additionalImages ?? '').split('|').map((item) => item.trim()).filter(Boolean).length;
  return main + additional;
}

function collectionError(product, status, error, extra = {}) {
  return {
    code: String(product.code),
    originalCode: String(product.originalCode ?? ''),
    name: product.name,
    blingCategoryPath: product.categoryPath,
    sourceSheet: product.sourceSheet,
    sourceRow: product.sourceRow,
    status,
    error,
    ...extra,
    images: [],
  };
}

function collectionIdentity(row) {
  return {
    code: String(row.code),
    originalCode: String(row.originalCode ?? ''),
    name: row.name,
    sourceSheet: row.sourceSheet,
    sourceRow: row.sourceRow,
    mundroneProductId: row.mundroneProductId,
    selectedVariantId: row.selectedVariantId,
  };
}

function publicInspection(image) {
  return {
    order: image.order,
    role: image.role,
    sourceUrl: image.sourceUrl,
    valid: image.valid,
    width: image.visual?.width ?? null,
    height: image.visual?.height ?? null,
    meanBrightness: image.visual?.meanBrightness ?? null,
    stdBrightness: image.visual?.stdBrightness ?? null,
    warnings: image.warnings ?? [],
  };
}

function summarizeCollection(rows, startedAt) {
  const matched = rows.filter((row) => row.status.startsWith('MATCH_'));
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalProducts: rows.length,
    matchedByExactId: rows.filter((row) => row.status === 'MATCH_EXATO_ID').length,
    matchedByAuditedOverride: rows.filter((row) => row.status === 'MATCH_ESPECIAL_VARIANTE').length,
    matchedByAuditableName: rows.filter((row) => row.status === 'MATCH_NOME_AUDITAVEL').length,
    productsWithGallery: matched.length,
    totalSourceImages: matched.reduce((total, row) => total + Number(row.imageCount ?? 0), 0),
    unmatched: rows.length - matched.length,
    statuses: countBy(rows, (row) => row.status),
  };
}

function summarizeUploads(rows, totalCatalogProducts, startedAt) {
  const copied = rows.filter((row) => row.status === 'COPIADO_SUPABASE');
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalCatalogProducts,
    productsEligibleFromCollection: rows.length,
    productsCopied: copied.length,
    imagesCopied: copied.reduce((total, row) => total + row.images.length, 0),
    blockedOrFailed: rows.length - copied.length,
    rejectedAdditionalImages: copied.reduce((total, row) => total + (row.rejectedAdditionalImages?.length ?? 0), 0),
    bucket: BUCKET,
    prefix: STORAGE_PREFIX,
    statuses: countBy(rows, (row) => row.status),
  };
}

function summarizePlan(plan) {
  return {
    productsToUpdate: plan.length,
    imagesToSend: plan.reduce((total, item) => total + item.imageCount, 0),
    allFromMundrone: plan.every((item) => item.sourceDomain === 'mundrone.com.br'),
    uniqueSkus: new Set(plan.map((item) => item.code)).size === plan.length,
    privateBlingAppOnly: true,
  };
}

async function writeReport({ collection, uploads, dryRun, result }) {
  const collectionSummary = collection?.summary ?? {};
  const uploadSummary = uploads?.summary ?? {};
  const failedCollection = (collection?.rows ?? []).filter((row) => !String(row.status).startsWith('MATCH_'));
  const failedUploads = (uploads?.rows ?? []).filter((row) => row.status !== 'COPIADO_SUPABASE');
  const apiFailures = (result?.updates ?? []).filter((row) => row.status === 'ERRO_API');
  const lines = [
    '# Imagens MundoDrone - novo catálogo Brasil Drones',
    '',
    `Atualizado em: ${new Date().toISOString()}`,
    '',
    '## Regras aplicadas',
    '- Fonte exclusiva nesta rodada: MundoDrone.',
    '- Código da planilha comparado ao idProduct público do MundoDrone.',
    '- Primeira imagem da galeria aprovada usada como imagem principal.',
    '- Todas as demais imagens válidas da mesma galeria mantidas na ordem.',
    '- Banners, placeholders, imagens pequenas, excessivamente escuras ou com baixa variação visual são rejeitados.',
    '- URLs finais servidas pelo bucket público do Supabase.',
    '- Atualização Bling restrita ao app privado Brasil Drones e ao campo midia.',
    '',
    '## Coleta',
    `- Produtos do catálogo: ${collectionSummary.totalProducts ?? 0}`,
    `- Correspondência por ID exato: ${collectionSummary.matchedByExactId ?? 0}`,
    `- Correspondência especial auditada: ${collectionSummary.matchedByAuditedOverride ?? 0}`,
    `- Correspondência auditável por nome/modelo/posição: ${collectionSummary.matchedByAuditableName ?? 0}`,
    `- Produtos com galeria: ${collectionSummary.productsWithGallery ?? 0}`,
    `- Imagens encontradas: ${collectionSummary.totalSourceImages ?? 0}`,
    `- Sem correspondência/galeria: ${collectionSummary.unmatched ?? 0}`,
    '',
    '## Supabase',
    `- Produtos copiados: ${uploadSummary.productsCopied ?? 0}`,
    `- Imagens copiadas: ${uploadSummary.imagesCopied ?? 0}`,
    `- Produtos bloqueados ou com erro: ${uploadSummary.blockedOrFailed ?? 0}`,
    `- Imagens adicionais rejeitadas: ${uploadSummary.rejectedAdditionalImages ?? 0}`,
    '',
    '## Dry-run Bling',
    `- Produtos planejados: ${dryRun?.summary?.productsToUpdate ?? 0}`,
    `- Imagens planejadas: ${dryRun?.summary?.imagesToSend ?? 0}`,
    '',
    '## Resultado Bling',
    `- Aceitos pela API: ${result?.summary?.acceptedByApi ?? 0}`,
    `- Atualizados e verificados: ${result?.summary?.updatedAndVerified ?? 0}`,
    `- Já atualizados: ${result?.summary?.alreadyUpdated ?? 0}`,
    `- Erros: ${result?.summary?.errors ?? 0}`,
    '- O campo imagensURL é writeOnly no OpenAPI; a API não devolve as URLs no GET.',
    '- A presença e a ordem da galeria foram confirmadas por amostragem visual no painel do Bling.',
    '',
    '## Pendências de coleta',
    ...(failedCollection.length
      ? failedCollection.map((row) => `- ${row.code} - ${row.name}: ${row.status} (${row.error ?? 'sem detalhe'})`)
      : ['- Nenhuma.']),
    '',
    '## Pendências de imagem',
    ...(failedUploads.length
      ? failedUploads.map((row) => `- ${row.code} - ${row.name}: ${row.status} (${row.error ?? 'sem detalhe'})`)
      : ['- Nenhuma.']),
    '',
    '## Pendências da API Bling',
    ...(apiFailures.length
      ? apiFailures.map((row) => `- ${row.code} - ${row.name}: ${row.status} (${row.error ?? 'verificação incompleta'})`)
      : ['- Nenhuma.']),
  ];
  await fs.writeFile(REPORT_FILE, `${lines.join('\n')}\n`, 'utf8');
}

function extractBlingExternalImages(product) {
  return (product?.midia?.imagens?.externas ?? []).map((item) => item?.link).filter(Boolean);
}

function verifyBlingImages(product, expectedUrls) {
  const externalUrls = extractBlingExternalImages(product);
  const internalUrls = (product?.midia?.imagens?.internas ?? []).map((item) => item?.link).filter(Boolean);
  const exactExternalMatch = sameUrls(externalUrls, expectedUrls);
  const hasPrimaryImage = Boolean(product?.imagemURL || externalUrls[0] || internalUrls[0]);
  return {
    ok: exactExternalMatch || (hasPrimaryImage && externalUrls.length === expectedUrls.length),
    exactExternalMatch,
    expectedCount: expectedUrls.length,
    externalCount: externalUrls.length,
    internalCount: internalUrls.length,
    primaryImage: product?.imagemURL ?? externalUrls[0] ?? internalUrls[0] ?? null,
  };
}

function sameUrls(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => normalizeUrl(value) === normalizeUrl(right[index]));
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value ?? '').trim();
  }
}

function extensionFor(contentType, format, url) {
  if (contentType === 'image/jpeg' || format === 'jpeg') return 'jpg';
  if (contentType === 'image/png' || format === 'png') return 'png';
  if (contentType === 'image/webp' || format === 'webp') return 'webp';
  if (contentType === 'image/avif' || format === 'heif') return 'avif';
  const match = new URL(url).pathname.match(/\.([a-z0-9]{3,4})$/i);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

function safePath(value) {
  return normalize(value).replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-sku';
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function browserHeaders(accept) {
  return {
    Accept: accept,
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36',
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'SEM_STATUS';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function dedupe(items) {
  return [...new Set(items)];
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    })
  );
  return results;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/Basic\s+\S+/gi, 'Basic [redacted]')
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]');
}

function extractBlingError(body) {
  return body?.error?.description ?? body?.error?.message ?? body?.error?.type ?? body?.message ?? 'bling_request_failed';
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
