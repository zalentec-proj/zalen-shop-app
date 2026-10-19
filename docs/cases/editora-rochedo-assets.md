# Editora Rochedo — assets da direção editorial

Referência: imagem de conceito fornecida pelo responsável em 19/10/2026,
com fundo creme, verde profundo, serifas e ambientação de livros. Foram usados
o gerador de imagens integrado (`imagegen`) e esta referência visual; não foi
usada API/CLI externa. As imagens são uma adaptação para o rascunho do case,
não o cadastro de livros reais nem um manual de marca oficial.

## Arquivos do app

- `public/brand/editora-rochedo/hero-editorial-v1.webp`: ambientação ilustrativa
  de livros, tablet e plantas; 1400 × 1050, aproximadamente 161 KiB.
- `public/brand/editora-rochedo/logo-editorial-v1.png`: wordmark em transparência,
  800 × 188, aproximadamente 57 KiB.
- `public/brand/editora-rochedo/icon-editorial-v1.png`: monograma em transparência,
  256 × 256, aproximadamente 36 KiB.

Os originais foram gerados no diretório padrão do Codex e os arquivos finais
foram copiados/otimizados para o repositório, com conversão WebP e PNG mantendo
o alpha das marcas. Nenhum arquivo depende do caminho temporário da conversa.

## Prompt da capa

Use case: product-mockup. Asset type: a standalone editorial still-life photograph for the RIGHT HALF of a book publisher storefront hero, inspired by the supplied reference image. The reference is a style/composition reference only, not an edit target. Create a refined photorealistic studio arrangement of a large cream linen hardcover book standing upright, an elegant tablet/e-reader displaying a misty green mountain landscape, 3-4 horizontal cream books stacked at the base, and two restrained leafy plants. A dark forest-green spine, subtle mountain illustration on the hardcover, warm ivory background and tabletop, natural soft daylight, realistic paper and linen texture. The books are illustrative brand imagery, NOT real catalog products. On the upright book and tablet cover use only a small refined letter R monogram and the exact brand text 'Rochedo' with small spaced 'E D I T O R A' below; absolutely no other typography anywhere, no invented titles. Compose a landscape image, roughly 4:3 aspect ratio, entire still life in frame, cropped close enough for a web hero, with a little breathing room, books mainly center-right; ivory edge blends with #F5F2EB. Do NOT render a website, navigation, buttons, headline, badge, or other UI. No promotional overlay text, no watermark. Colors: forest green #2F543E, deep green #18372A, warm cream #F5F2EB, subtle sage #E6EADD. Render only the beautiful still-life asset.

## Prompt do wordmark

Use case: background-extraction / logo-brand. Asset type: transparent publisher wordmark for a real website header. Edit target: the Rochedo Editora logo at the TOP LEFT of the supplied webpage reference. Recreate and isolate only that logo as a clean high resolution raster with actual alpha transparency. Keep the same design: thin dark forest-green line-art uppercase R monogram with a mountain line integrated in it, to the left; elegant black high-contrast serif word 'Rochedo' to the right, and the small widely-spaced forest-green word 'E d i t o r a' below Rochedo. Exact text: 'Rochedo' and 'Editora'. Flat ink marks, no shadows, no paper, no texture, no website elements, no other lettering, no background. Horizontal lockup, close crop with only a modest transparent margin around the whole wordmark, approx 4:1 aspect ratio. Preserve all letter strokes; ensure a transparent background, no checkerboard baked in.

## Prompt do ícone

Asset type: square favicon / brand icon. Edit target: the thin forest green R mountain monogram on the top-left publisher logo in the supplied reference. Isolate and recreate ONLY the R symbol, with its parallel thin vertical lines and integrated mountain silhouette, on a fully transparent background. Exact same green line-art visual identity. No wordmark, no text, no website, no shadow, no paper, no border. Center one large clear dark forest green #244831 monogram within a square composition with modest margin, high resolution, crisp enough to reduce to a favicon. Actual alpha transparency.
