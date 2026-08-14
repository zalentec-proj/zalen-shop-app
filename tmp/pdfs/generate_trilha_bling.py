from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "trilha-bling-brasil-drones.pdf"


def link(label: str, url: str) -> str:
    return f'<link href="{url}" color="#1466cc"><u>{label}</u></link>'


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d8dee9"))
    canvas.line(doc.leftMargin, 1.2 * cm, A4[0] - doc.rightMargin, 1.2 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawString(doc.leftMargin, 0.8 * cm, "Brasil Drones - Trilha operacional Bling")
    canvas.drawRightString(A4[0] - doc.rightMargin, 0.8 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def module(number, title, objective, materials, practice, styles):
    material_lines = [f"<b>Objetivo:</b> {objective}"]
    for label, url in materials:
        material_lines.append(f"<b>Material:</b> {link(label, url)}")
    material_lines.append(f"<b>Pratica:</b> {practice}")

    heading = Paragraph(f"{number}. {title}", styles["ModuleHeading"])
    body = Paragraph("<br/>".join(material_lines), styles["ModuleBody"])
    table = Table([[heading], [body]], colWidths=[17.1 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e2a47")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f6f8fb")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8dee9")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#d8dee9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 0.32 * cm)])


def bullet(text, styles):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", styles["CustomBullet"])


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleCustom",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0e2a47"),
            alignment=TA_LEFT,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Subtitle",
            parent=styles["Normal"],
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#475467"),
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=colors.HexColor("#0e2a47"),
            spaceBefore=8,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ModuleHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ModuleBody",
            parent=styles["Normal"],
            fontSize=9.4,
            leading=13.2,
            textColor=colors.HexColor("#1d2939"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CustomBullet",
            parent=styles["Normal"],
            fontSize=9.6,
            leading=14,
            leftIndent=13,
            firstLineIndent=-8,
            spaceAfter=4,
            textColor=colors.HexColor("#1d2939"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Callout",
            parent=styles["Normal"],
            fontSize=9.8,
            leading=14,
            textColor=colors.HexColor("#1d2939"),
            backColor=colors.HexColor("#edf5ff"),
            borderColor=colors.HexColor("#a9cdf5"),
            borderWidth=0.5,
            borderPadding=10,
            spaceBefore=4,
            spaceAfter=10,
        )
    )

    story = [
        Paragraph("Trilha Bling - Brasil Drones", styles["TitleCustom"]),
        Paragraph(
            "Plano simples de treinamento para a equipe operar a loja online vinculada ao Bling, com estoque, pedidos, faturamento e marketplaces sob controle.",
            styles["Subtitle"],
        ),
        Paragraph(
            "<b>Como usar:</b> um modulo por dia, em sessao de 30 a 45 minutos. Assistir ao material, executar a pratica no ambiente real e registrar qualquer duvida antes de seguir.",
            styles["Callout"],
        ),
        Paragraph("Semana 1 - Fundacao operacional", styles["Section"]),
        module(
            "1",
            "Produtos, SKU e cadastro seguro",
            "Entender que o Bling e a fonte de verdade para SKU, preco, estoque e dados fiscais do catalogo.",
            [
                ("Video oficial: produto simples e variacoes", "https://www.youtube.com/watch?v=2hjqgL9hljk"),
            ],
            "Localizar cinco produtos DJI, conferir SKU, preco, unidade e categoria. Nao editar NCM sem validacao fiscal.",
            styles,
        ),
        module(
            "2",
            "Estoque e deposito",
            "Manter o saldo fisico igual ao saldo do Bling e movimentar tudo pelo deposito correto.",
            [
                ("Video: controle de estoque", "https://www.youtube.com/watch?v=zM_dhiANBmw"),
                ("Video: movimentacoes de estoque", "https://www.youtube.com/watch?v=dHogsYSRQ44"),
                ("Ajuda oficial: cadastrar deposito", "https://ajuda.bling.com.br/hc/pt-br/articles/360036176533-Cadastrar-um-dep%C3%B3sito-de-estoque"),
            ],
            "Fazer uma movimentacao de teste orientada e confirmar o saldo no deposito. Depois, registrar a reversao da movimentacao.",
            styles,
        ),
        module(
            "3",
            "Entrada de mercadoria e conferencia",
            "Conferir itens recebidos e evitar alterar saldo manualmente sem justificativa.",
            [
                ("Video: entrada de mercadoria", "https://www.youtube.com/watch?v=_DVebA4QMkQ"),
                ("Ajuda oficial: conciliar produtos de nota e estoque", "https://ajuda.bling.com.br/hc/pt-br/articles/360044990973-Como-conciliar-os-produtos-da-nota-com-produtos-do-meu-estoque"),
            ],
            "Simular o recebimento de uma peca e conferir SKU, quantidade e custo antes de concluir.",
            styles,
        ),
        module(
            "4",
            "Pedidos da loja Zalen Shop",
            "Acompanhar pedidos que chegam da loja sem criar duplicidade manual no Bling.",
            [
                ("Video oficial: pedidos de venda", "https://www.youtube.com/watch?v=4kloUZ3DTME"),
            ],
            "Fazer um pedido teste na loja, confirmar que ele apareceu uma unica vez no Bling e revisar itens, frete e dados do cliente.",
            styles,
        ),
        PageBreak(),
        Paragraph("Semana 2 - Faturamento e canais", styles["Section"]),
        module(
            "5",
            "NF-e e expedicao",
            "Emitir nota apenas quando o pedido estiver conferido e usar a situacao correta do pedido.",
            [
                ("Video oficial: emissao de NF-e", "https://www.youtube.com/watch?v=lJJFl8TBDts"),
            ],
            "Abrir um pedido de teste, conferir dados fiscais e identificar quem na equipe pode autorizar a emissao. Nao emitir uma NF-e real durante o treinamento.",
            styles,
        ),
        module(
            "6",
            "Mercado Livre: operacao legada com seguranca",
            "Vincular anuncios ja existentes pelo SKU antes de qualquer sincronizacao em massa.",
            [
                ("Ajuda oficial: sincronizar estoque de anuncios Mercado Livre", "https://ajuda.bling.com.br/hc/pt-br/articles/34346576685207-Como-sincronizar-estoque-para-an%C3%BAncios-do-Mercado-Livre-pelo-Bling"),
            ],
            "Escolher tres anuncios antigos, comparar SKU do Mercado Livre com SKU no Bling e registrar divergencias. Nao apagar, importar em massa nem reenviar catalogo sem revisao.",
            styles,
        ),
        module(
            "7",
            "Shopee: piloto controlado",
            "Comecar a operacao nova com poucos produtos completos e validar o ciclo inteiro antes de escalar.",
            [
                ("Ajuda oficial: produtos da Shopee", "https://ajuda.bling.com.br/hc/pt-br/articles/360056426734-Produtos-da-Shopee-Informa%C3%A7%C3%B5es-Gerais"),
            ],
            "Selecionar tres SKUs com foto, preco, saldo e dados logisticos revisados. Publicar somente apos validar a configuracao de frete e fiscal.",
            styles,
        ),
        Paragraph("Rotina diaria recomendada", styles["Section"]),
        bullet("Inicio do dia: conferir novos pedidos, pagamentos pendentes e saldo de itens vendidos.", styles),
        bullet("Antes de faturar: confirmar item, SKU, quantidade, endereco, frete e dados fiscais.", styles),
        bullet("Depois de expedir: atualizar o pedido somente no fluxo definido e guardar o comprovante de postagem.", styles),
        bullet("Fim do dia: revisar pedidos abertos, cancelamentos, devolucoes e diferencas de estoque.", styles),
        Paragraph("Regras que evitam problemas", styles["Section"]),
        bullet("Cadastrar novo produto primeiro no Bling e sempre com SKU unico.", styles),
        bullet("Nao ajustar estoque diretamente em Mercado Livre, Shopee ou loja online; o saldo deve partir do Bling.", styles),
        bullet("Nao criar pedido manual quando ele ja foi importado de um canal.", styles),
        bullet("Nao excluir anuncio legado ou exportar produtos em massa sem validar os SKUs e a direcao da sincronizacao.", styles),
        bullet("NCM, tributacao e emissao fiscal devem seguir a decisao do responsavel fiscal/contador.", styles),
        Paragraph("Criterio de conclusao", styles["Section"]),
        Paragraph(
            "A equipe esta pronta para a rotina quando consegue cadastrar ou localizar um SKU, conferir saldo no deposito, identificar um pedido recebido da loja, revisar dados antes da NF-e e explicar por que Mercado Livre e Shopee devem ser ativados por piloto, nunca em lote sem conferencia.",
            styles["Callout"],
        ),
    ]
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=1.45 * cm,
        leftMargin=1.45 * cm,
        topMargin=1.35 * cm,
        bottomMargin=1.65 * cm,
        title="Trilha Bling - Brasil Drones",
        author="Brasil Drones",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()
    print(OUTPUT)
