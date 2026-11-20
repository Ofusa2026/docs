#!/usr/bin/env python3
"""大房行政書士法人 見積書PDFジェネレーター（マネーフォワード見積書と同じレイアウト）

使い方:
  python3 mitsumori.py input.json output.pdf [--assets DIR]

input.json の例:
{
  "to": "富士産業株式会社",          # 宛名（「御中」は自動で付く）
  "to_sub": "北海道事業部",          # 部署・担当者など（省略可）
  "honorific": "御中",               # 省略時「御中」。個人宛なら「様」
  "issue_date": "2026/11/20",        # 省略時は今日（日本時間）
  "valid_until": "2026/11/30",       # 省略時は発行日の10日後
  "items": [
    {"name": "在留期間更新申請", "price": 20000, "qty": 1, "unit": "名"},
    {"name": "収入印紙", "price": 4000, "qty": 1, "unit": "枚", "tax": "不課税"}
  ],
  "notes": null                      # 省略時は標準の備考。文字列なら差し替え
}
tax は "10%"（省略時）／"8%"／"不課税"／"非課税"。消費税は税率ごとに切り捨て。
"""
import json, os, sys, glob, datetime, argparse
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

W, H = 594.96, 841.92
GRAY = (0.6667, 0.6667, 0.6667)

ISSUER = ["大房行政書士法人", None, "〒144-0052", "東京都大田区",
          "蒲田５丁目１１−１０ FUNDES蒲田8階", "TEL: 03-6424-8849", "FAX: 03-6424-8854"]

DEFAULT_NOTES = [
    "(1)お支払いに関しては、着手月末請求/翌月支払いとなります。",
    "(2)キャンセル時の返金につきましては、以下の通りです。",
    "請求後申請前　　：70％ご返金",
    "申請後審査完了前：50％ご返金",
    "申請後審査完了後：0％ご返金",
    "不許可時　　　　：100％ご返金(または再申請)",
    "※許可後(変更申請・更新申請)の収入印紙代につきましてはお客様のご負担となりますので、",
    "あらかじめご了承くださいますようお願いいたします。",
]


def find_font():
    cands = ["/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
             "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
             "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"]
    cands += glob.glob("/usr/share/fonts/**/ipagp.ttf", recursive=True)
    cands += glob.glob("/usr/share/fonts/**/ipaexg.ttf", recursive=True)
    try:
        import japanize_matplotlib  # pip install japanize-matplotlib（IPAexゴシック同梱）
        cands += glob.glob(os.path.join(os.path.dirname(japanize_matplotlib.__file__), "fonts", "*.ttf"))
    except Exception:
        pass
    for c in cands:
        if os.path.exists(c):
            return c
    sys.exit("日本語TTFフォントが見つかりません: pip install --break-system-packages japanize-matplotlib")


def yen(n):
    return f"{int(n):,}"


def parse_date(s, default):
    if not s:
        return default
    s = str(s).replace("-", "/").replace(".", "/")
    return datetime.datetime.strptime(s, "%Y/%m/%d").date()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--assets", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets"))
    a = ap.parse_args()
    d = json.load(open(a.input, encoding="utf-8"))

    pdfmetrics.registerFont(TTFont("JP", find_font()))
    F = "JP"
    today = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).date()
    issue = parse_date(d.get("issue_date"), today)
    valid = parse_date(d.get("valid_until"), issue + datetime.timedelta(days=10))

    # ---- 金額計算 ----
    rows, by_tax = [], {}
    for it in d["items"]:
        price, qty = float(it["price"]), float(it.get("qty", 1))
        amt = round(price * qty)
        tax = it.get("tax", "10%")
        by_tax[tax] = by_tax.get(tax, 0) + amt
        rows.append((it["name"], price, qty, it.get("unit", ""), amt))
    rates = {"10%": 0.10, "8%": 0.08}
    tax_amt = {k: int(v * rates[k]) for k, v in by_tax.items() if k in rates}
    subtotal = sum(by_tax.values())
    tax_total = sum(tax_amt.values())
    total = subtotal + tax_total

    c = canvas.Canvas(a.output, pagesize=(W, H))
    c.setTitle("見積書")

    def T(x, y, s, size=10.49, align="l"):
        c.setFont(F, size)
        y = H - y
        if align == "r":
            c.drawRightString(x, y, s)
        elif align == "c":
            c.drawCentredString(x, y, s)
        else:
            c.drawString(x, y, s)

    def hline(x1, x2, y):
        c.setFillColorRGB(*GRAY)
        c.rect(x1, H - y - 0.75, x2 - x1, 0.75, stroke=0, fill=1)
        c.setFillColorRGB(0, 0, 0)

    # ---- ヘッダー ----
    T(W / 2, 47.7, "見積書", 20.98, "c")
    T(23.0, 81.4, f'{d["to"]} {d.get("honorific", "御中")}')
    if d.get("to_sub"):
        T(23.0, 103.2, d["to_sub"])

    logo = os.path.join(a.assets, "logo.png")
    seal = os.path.join(a.assets, "seal.png")
    if os.path.exists(logo):
        c.drawImage(ImageReader(logo), 411.9, H - 108.42, 128.88, 37.47, mask="auto")
    ys = [133.9, None, 155.6, 169.9, 184.1, 198.3, 212.6]
    for s, y in zip(ISSUER, ys):
        if s:
            T(411.7, y, s)
    if os.path.exists(seal):
        c.drawImage(ImageReader(seal), 513.05, H - 183.35, 59.95, 59.95, mask="auto")
    if d.get("number"):
        T(411.7, 240.3, f'見積書番号：{d["number"]}')
        dy = 0
    else:
        dy = -10.5
    T(411.7, 250.8 + dy, "発行日：")
    T(469.4, 250.8 + dy, issue.strftime("%Y/%m/%d"))
    T(411.7, 261.3 + dy, "有効期限：")
    T(469.4, 261.3 + dy, valid.strftime("%Y/%m/%d"))

    # ---- 御見積金額 ----
    T(23.0, 306.2, f"御見積金額 {yen(total)} 円", 11.99)
    hline(23.0, 573.0, 311.5)

    # ---- 明細 ----
    T(23.7, 346.0, "品目", 11.99)
    T(351.2, 346.0, "単価", 11.99, "r")
    T(420.1, 346.0, "数量", 11.99, "r")
    T(475.2, 346.0, "単位", 11.99, "r")
    T(571.5, 346.0, "価格", 11.99, "r")
    hline(23.0, 572.25, 348.2)
    y = 364.7
    ROW = 18.5
    for name, price, qty, unit, amt in rows:
        T(26.7, y - 1.5, name, 11.99)
        T(376.7, y, yen(price) if price == int(price) else f"{price:,.2f}", 11.99, "r")
        T(432.1, y, yen(qty) if qty == int(qty) else str(qty), 11.99, "r")
        T(486.8, y, unit, 11.99, "r")
        T(568.5, y, yen(amt), 11.99, "r")
        y += ROW
    off = y - ROW - 364.7  # 2行目以降の分だけ下へずらす

    # ---- 合計欄 ----
    def tot(label, val, yy):
        T(348.0, yy + off, label)
        T(572.8, yy + off, f"{yen(val)} 円", 10.49, "r")
        hline(348.2, 573.0, yy + off + 1.5)
    tot("小計", subtotal, 395.4)
    tot("消費税", tax_total, 414.1)
    tot("合計", total, 432.9)
    yy = 452.4 + off
    first = True
    for k in ["10%", "8%", "不課税", "非課税"]:
        if k not in by_tax:
            continue
        if first:
            T(348.0, yy, "内訳", 9.74)
            first = False
        lab = f"{k}対象" if k in rates else k
        T(447.9, yy, lab, 9.74, "r")
        T(572.8, yy, f"{yen(by_tax[k])} 円", 9.74, "r")
        if k in rates:
            T(572.8, yy + 12.7, f"消費税 {yen(tax_amt[k])} 円", 8.24, "r")
            yy += 12.7
        yy += 14.0
    line_y = max(474.8 + off, yy - 3)
    hline(348.2, 573.0, line_y)

    # ---- 備考 ----
    shift = line_y - 474.8
    notes = d.get("notes")
    lines = DEFAULT_NOTES if not notes else (notes if isinstance(notes, list) else str(notes).split("\n"))
    T(23.0, 492.1 + shift, "備考")
    ny = 517.6 + shift
    for i, s in enumerate(lines):
        T(31.2, ny, s)
        ny += 13.4 if i < 2 else 10.5
    box_top, box_bot = 496.2 + shift, max(609.3 + shift, ny + 2)
    c.setStrokeColorRGB(*GRAY)
    c.setLineWidth(0.75)
    c.rect(23.37, H - box_bot, 549.25, box_bot - box_top, stroke=1, fill=0)
    if box_bot > 800:
        sys.exit("明細が多すぎて1ページに収まりません。品目をまとめてください。")

    T(W / 2, 826.3, "1 / 1", 12.0, "c")
    c.save()
    print(f"OK {a.output}  小計{yen(subtotal)} 消費税{yen(tax_total)} 合計{yen(total)}")


if __name__ == "__main__":
    main()
