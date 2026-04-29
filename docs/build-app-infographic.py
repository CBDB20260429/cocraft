from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


OUT = Path(__file__).with_name("cocraft-app-infographic.pdf")
PAGE_W, PAGE_H = landscape((16 * inch, 9 * inch))


PALETTE = {
    "ink": colors.HexColor("#15202B"),
    "muted": colors.HexColor("#607080"),
    "paper": colors.HexColor("#FBFAF5"),
    "grid": colors.HexColor("#E6E0D4"),
    "teal": colors.HexColor("#008A83"),
    "teal_light": colors.HexColor("#DDF3EF"),
    "blue": colors.HexColor("#3266C8"),
    "blue_light": colors.HexColor("#E5EEFF"),
    "gold": colors.HexColor("#D79B22"),
    "gold_light": colors.HexColor("#FFF0C9"),
    "rose": colors.HexColor("#C64D6B"),
    "rose_light": colors.HexColor("#FFE2E8"),
    "violet": colors.HexColor("#7756C7"),
    "violet_light": colors.HexColor("#EEE8FF"),
    "green": colors.HexColor("#3D8B4D"),
    "green_light": colors.HexColor("#E3F4E6"),
}


def rounded(c: canvas.Canvas, x, y, w, h, r, fill, stroke=None, sw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke else 0)


def label(c: canvas.Canvas, txt, x, y, size=12, color=None, font="Helvetica", bold=False):
    c.setFillColor(color or PALETTE["ink"])
    c.setFont("Helvetica-Bold" if bold else font, size)
    c.drawString(x, y, txt)


def centered(c: canvas.Canvas, txt, x, y, w, size=12, color=None, bold=False):
    c.setFillColor(color or PALETTE["ink"])
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x + (w - stringWidth(txt, "Helvetica-Bold" if bold else "Helvetica", size)) / 2, y, txt)


def paragraph(c: canvas.Canvas, txt, x, y, w, size=11, color=None, leading=14, max_lines=None):
    c.setFillColor(color or PALETTE["ink"])
    c.setFont("Helvetica", size)
    avg = max(18, int(w / (size * 0.48)))
    lines = []
    for part in txt.split("\n"):
        lines.extend(wrap(part, avg))
    if max_lines:
        lines = lines[:max_lines]
    for i, line in enumerate(lines):
        c.drawString(x, y - i * leading, line)
    return y - len(lines) * leading


def pill(c: canvas.Canvas, txt, x, y, fill, stroke=None, size=9):
    w = stringWidth(txt, "Helvetica-Bold", size) + 18
    rounded(c, x, y, w, 20, 10, fill, stroke or fill, 0.6)
    centered(c, txt, x, y + 6, w, size=size, color=PALETTE["ink"], bold=True)
    return w


def arrow(c: canvas.Canvas, x1, y1, x2, y2, color=None, sw=2.2):
    color = color or PALETTE["muted"]
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(sw)
    c.line(x1, y1, x2, y2)
    size = 7
    c.line(x2, y2, x2 - size, y2 + size / 2)
    c.line(x2, y2, x2 - size, y2 - size / 2)


def card(c: canvas.Canvas, x, y, w, h, title, body, fill, accent, footer=None):
    rounded(c, x, y, w, h, 14, fill, accent, 1.4)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 12, w, 12, 7, fill=1, stroke=0)
    label(c, title, x + 18, y + h - 38, 16, PALETTE["ink"], bold=True)
    paragraph(c, body, x + 18, y + h - 61, w - 36, 10.2, PALETTE["ink"], 13)
    if footer:
        c.setStrokeColor(colors.Color(accent.red, accent.green, accent.blue, alpha=0.35))
        c.line(x + 18, y + 30, x + w - 18, y + 30)
        paragraph(c, footer, x + 18, y + 17, w - 36, 8.4, PALETTE["muted"], 10, max_lines=1)


def draw_icon_doc(c, x, y, color):
    rounded(c, x, y, 30, 38, 5, colors.white, color, 1.5)
    c.setStrokeColor(color)
    c.setLineWidth(1.1)
    for i in range(4):
        c.line(x + 7, y + 29 - i * 7, x + 23, y + 29 - i * 7)


def draw_icon_graph(c, x, y, color):
    c.setStrokeColor(color)
    c.setFillColor(colors.white)
    c.setLineWidth(1.5)
    pts = [(x + 8, y + 10), (x + 28, y + 30), (x + 44, y + 14), (x + 24, y + 4)]
    for a, b in [(0, 1), (1, 2), (1, 3), (0, 3)]:
        c.line(*pts[a], *pts[b])
    for px, py in pts:
        c.circle(px, py, 5, fill=1, stroke=1)


def draw_pdf():
    c = canvas.Canvas(str(OUT), pagesize=(PAGE_W, PAGE_H))

    c.setFillColor(PALETTE["paper"])
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(PALETTE["grid"])
    c.setLineWidth(0.4)
    for x in range(0, int(PAGE_W), 36):
        c.line(x, 0, x, PAGE_H)
    for y in range(0, int(PAGE_H), 36):
        c.line(0, y, PAGE_W, y)

    label(c, "How Cocraft Turns Transcripts Into Playable Story Graphs", 54, PAGE_H - 62, 26, PALETTE["ink"], bold=True)
    paragraph(
        c,
        "A staged operator workflow: local transcript evidence becomes a reviewed graph, then the app projects it into data review, story-so-far play mode, and grounded future cards.",
        56,
        PAGE_H - 88,
        780,
        12.5,
        PALETTE["muted"],
        16,
    )
    pill(c, "Next.js", PAGE_W - 284, PAGE_H - 68, PALETTE["blue_light"], PALETTE["blue"], 9)
    pill(c, "OpenAI", PAGE_W - 213, PAGE_H - 68, PALETTE["rose_light"], PALETTE["rose"], 9)
    pill(c, "Neo4j", PAGE_W - 136, PAGE_H - 68, PALETTE["green_light"], PALETTE["green"], 9)

    top_y = 370
    w = 162
    h = 150
    gap = 24
    x0 = 54
    cards = [
        ("1. Transcript Files", "Markdown episodes in transcripts/ hold source URLs, episode metadata, and timestamped dialogue lines.", PALETTE["gold_light"], PALETTE["gold"], "lib/transcripts.ts"),
        ("2. Server Routes", "The browser asks API handlers to list files, extract drafts, insert approved JSON, and read graph projections.", PALETTE["blue_light"], PALETTE["blue"], "app/api/**"),
        ("3. LLM Draft", "OpenAI converts parsed dialogue into a typed TranscriptGraphDraft with nodes, links, evidence, and notes.", PALETTE["rose_light"], PALETTE["rose"], "lib/transcript-graph-agent.ts"),
        ("4. Review Gate", "The operator edits the JSON draft. Only valid, approved graph payloads can be inserted.", colors.white, PALETTE["ink"], "StoryWorkspace textarea"),
        ("5. Neo4j Graph", "The repository upserts source, episode, people, story-world objects, time anchors, and typed relationships.", PALETTE["green_light"], PALETTE["green"], "lib/story-graph-repository.ts"),
        ("6. Playable Views", "React Flow renders a data constellation, play timeline, and future cards grounded in graph context.", PALETTE["violet_light"], PALETTE["violet"], "components/story-workspace.tsx"),
    ]
    xs = [x0 + i * (w + gap) for i in range(len(cards))]
    for i, (title, body, fill, accent, footer) in enumerate(cards):
        card(c, xs[i], top_y, w, h, title, body, fill, accent, footer)
        if i < len(cards) - 1:
            arrow(c, xs[i] + w + 5, top_y + h / 2, xs[i + 1] - 7, top_y + h / 2, PALETTE["muted"])

    c.setStrokeColor(PALETTE["ink"])
    c.setLineWidth(1.2)
    c.line(54, 335, PAGE_W - 54, 335)
    label(c, "What moves through the system", 54, 314, 15, PALETTE["ink"], bold=True)

    flow_y = 246
    small_w = 185
    flow = [
        ("Evidence", "Parsed timestamped lines + episode metadata"),
        ("Interpretation", "Characters, scenes, events, quests, conflicts, revelations"),
        ("Validation", "Zod schemas + allowed labels + allowed relationship types"),
        ("Persistence", "Neo4j nodes, links, load status, story anchors"),
        ("Projection", "Constellation graph, timeline graph, focused future context"),
    ]
    for i, (t, b) in enumerate(flow):
        x = 86 + i * 210
        rounded(c, x, flow_y, small_w, 64, 12, colors.white, PALETTE["grid"], 1)
        label(c, t, x + 16, flow_y + 40, 13, PALETTE["ink"], bold=True)
        paragraph(c, b, x + 16, flow_y + 23, small_w - 30, 8.8, PALETTE["muted"], 10, max_lines=2)
        if i < len(flow) - 1:
            arrow(c, x + small_w + 7, flow_y + 32, x + 203, flow_y + 32, PALETTE["muted"], 1.6)

    left_x, base_y = 58, 88
    rounded(c, left_x, base_y, 330, 116, 16, colors.white, PALETTE["blue"], 1.2)
    label(c, "Operator Console", left_x + 20, base_y + 86, 15, PALETTE["blue"], bold=True)
    paragraph(
        c,
        "The browser orchestrates work, but credentials and filesystem access stay server-side. Activity logs expose request ids, extraction metadata, insert counts, and failures.",
        left_x + 20,
        base_y + 63,
        286,
        10.5,
        PALETTE["ink"],
        13,
    )

    mid_x = 410
    rounded(c, mid_x, base_y, 320, 116, 16, colors.white, PALETTE["rose"], 1.2)
    label(c, "Safety Pattern", mid_x + 20, base_y + 86, 15, PALETTE["rose"], bold=True)
    paragraph(
        c,
        "LLM output is an intermediate artifact, not canon. Unsupported links are normalized or dropped, JSON must validate, and insertion happens only after review.",
        mid_x + 20,
        base_y + 63,
        276,
        10.5,
        PALETTE["ink"],
        13,
    )

    right_x = 752
    rounded(c, right_x, base_y, 336, 116, 16, colors.white, PALETTE["green"], 1.2)
    label(c, "Two Read Models", right_x + 20, base_y + 86, 15, PALETTE["green"], bold=True)
    paragraph(
        c,
        "Data mode favors graph inspection. Play mode compresses dense Neo4j facts into episode moments, nearby details, and future cards for live story planning.",
        right_x + 20,
        base_y + 63,
        294,
        10.5,
        PALETTE["ink"],
        13,
    )

    label(c, "Core routes: /api/transcripts -> /api/transcripts/extract -> /api/transcripts/insert -> /api/graph -> /api/graph/play -> /api/graph/future", 54, 34, 10, PALETTE["muted"])
    c.showPage()
    c.save()


if __name__ == "__main__":
    draw_pdf()
    print(OUT.resolve())
