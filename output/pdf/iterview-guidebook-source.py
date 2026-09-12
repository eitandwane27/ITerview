from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "iterview-friendly-guidebook.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
FONTS = Path("C:/Windows/Fonts")
for name, file in [("Guide", "segoeui.ttf"), ("GuideBold", "segoeuib.ttf"),
                   ("GuideSemi", "seguisb.ttf"), ("GuideItalic", "segoeuii.ttf")]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold",
                              italic="GuideItalic", boldItalic="GuideBold")

W, H = A4
M = 44
CW = W - 2 * M
INK = colors.HexColor("#17243A")
MUTED = colors.HexColor("#53647B")
BLUE = colors.HexColor("#2563EB")
TEAL = colors.HexColor("#087E67")
VIOLET = colors.HexColor("#6950B7")
AMBER = colors.HexColor("#9B641B")
PALE_BLUE = colors.HexColor("#EDF4FF")
PALE_TEAL = colors.HexColor("#EAF7F1")
PALE_VIOLET = colors.HexColor("#F2EDFA")
PALE_AMBER = colors.HexColor("#FFF5E4")
LINE = colors.HexColor("#DDE5EF")
WHITE = colors.white

c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("ITerview - Your interview journey and research guide")
c.setAuthor("ITerview capstone team")
c.setSubject("Friendly user roadmaps, hypothesis evidence, and dashboard development roadmap")
c.setKeywords("ITerview, 3C, confidence, interview, roadmap, ICC, research")
page = 0
y = H - M
measurements = []
layout_bottom = {}


def style(size=11.2, leading=None, color=INK, bold=False):
    return ParagraphStyle("guide", fontName="GuideBold" if bold else "Guide",
                          fontSize=size, leading=leading or size * 1.43,
                          textColor=color, alignment=TA_LEFT, spaceAfter=0,
                          allowWidows=0, allowOrphans=0)


def text_at(text, x, top, width, size=11.2, color=INK, bold=False, leading=None):
    para = Paragraph(text, style(size, leading, color, bold))
    _, height = para.wrap(width, 1000)
    para.drawOn(c, x, top - height)
    measurements.append((page, x, top - height, width, height, text[:65]))
    return height


def p(text, size=11.2, color=INK, bold=False, gap=9):
    global y
    height = text_at(text, M, y, CW, size, color, bold)
    y -= height + gap
    check()


def heading(text):
    global y
    y -= 8
    p(text, 15, bold=True, gap=8)


def check():
    layout_bottom[page] = min(layout_bottom.get(page, H), y)


def callout(label, body, bg=PALE_BLUE, accent=BLUE):
    global y
    label_para = Paragraph(label, style(11.2, 15, accent, True))
    body_para = Paragraph(body, style(11.0, 15.5))
    _, lh = label_para.wrap(CW - 34, 1000)
    _, bh = body_para.wrap(CW - 34, 1000)
    height = lh + bh + 31
    c.setFillColor(bg)
    c.roundRect(M, y - height, CW, height, 10, fill=1, stroke=0)
    c.setFillColor(accent)
    c.roundRect(M, y - height, 4, height, 2, fill=1, stroke=0)
    label_para.drawOn(c, M + 17, y - 13 - lh)
    body_para.drawOn(c, M + 17, y - 19 - lh - bh)
    y -= height + 13
    check()


def table(headers, rows, fractions, size=10.6):
    global y
    widths = [CW * fraction for fraction in fractions]
    data = [[Paragraph(escape(head), style(size, size * 1.35, WHITE, True))
             for head in headers]]
    data += [[Paragraph(cell, style(size, size * 1.37)) for cell in row]
             for row in rows]
    t = Table(data, colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F5F8FC")]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
    ]))
    _, height = t.wrap(CW, 1000)
    t.drawOn(c, M, y - height)
    y -= height + 13
    check()


def step(number, title, body, accent=BLUE):
    global y
    body_h = Paragraph(body, style(11, 15.5)).wrap(CW - 51, 1000)[1]
    title_h = Paragraph(title, style(12.3, 17, INK, True)).wrap(CW - 51, 1000)[1]
    height = max(29, title_h + body_h + 5)
    c.setFillColor(accent)
    c.circle(M + 14, y - 15, 13, fill=1, stroke=0)
    c.setFont("GuideBold", 11)
    c.setFillColor(WHITE)
    c.drawCentredString(M + 14, y - 19, str(number))
    text_at(title, M + 42, y, CW - 42, 12.3, bold=True, leading=17)
    text_at(body, M + 42, y - title_h - 5, CW - 42, 11, leading=15.5)
    y -= height + 18
    check()


def bullet(title, body):
    p(f"<b>{title}</b> {body}", gap=11)


def arrow(cx, top, bottom, color=BLUE):
    c.setStrokeColor(color)
    c.setLineWidth(1.6)
    c.line(cx, top, cx, bottom + 5)
    c.setFillColor(color)
    path = c.beginPath()
    path.moveTo(cx - 4, bottom + 6)
    path.lineTo(cx + 4, bottom + 6)
    path.lineTo(cx, bottom)
    path.close()
    c.drawPath(path, stroke=0, fill=1)


def footer(source):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(M, 46, W - M, 46)
    c.setFont("Guide", 8)
    c.setFillColor(MUTED)
    c.drawString(M, 31, "ITerview / Friendly system guide / Working edition")
    c.drawRightString(W - M, 31, f"{page:02d}")
    if source:
        c.setFont("Guide", 7.4)
        c.drawString(M, 53, f"Sources: {source}. See page 13.")


def new_page(title, subtitle, section, source="", bookmark=""):
    global page, y
    if page:
        c.showPage()
    page += 1
    c.setFillColor(WHITE)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.roundRect(M, H - 61, 28, 4, 2, fill=1, stroke=0)
    c.setFont("GuideSemi", 9)
    c.setFillColor(MUTED)
    c.drawString(M + 39, H - 62, section.upper())
    c.drawRightString(W - M, H - 62, "ITerview")
    y = H - 88
    p(title, 27, bold=True, gap=9)
    if subtitle:
        p(subtitle, 12.2, color=MUTED, gap=16)
    key = bookmark or f"page-{page}"
    c.bookmarkPage(key)
    c.addOutlineEntry(title, key, level=0, closed=False)
    footer(source)


def phase(label, actions, note, bg, accent, height):
    global y
    c.setFillColor(bg)
    c.roundRect(M, y - height, CW, height, 11, fill=1, stroke=0)
    text_at(label, M + 18, y - 14, CW - 36, 13.2, accent, True, 18)
    top = y - 44
    for action in actions:
        c.setFillColor(accent)
        c.circle(M + 22, top - 7, 2.5, fill=1, stroke=0)
        ah = text_at(action, M + 34, top, CW - 52, 11, leading=15)
        top -= ah + 8
    text_at(note, M + 18, y - height + 29, CW - 36, 9.6, MUTED, leading=13)
    y -= height
    check()


def journey_example(label, status, action, body, bg=PALE_BLUE, accent=BLUE):
    global y
    title_h = Paragraph(label, style(12.2, 17, accent, True)).wrap(CW - 36, 1000)[1]
    status_h = Paragraph(status, style(10.4, 14.8)).wrap(CW - 36, 1000)[1]
    body_h = Paragraph(body, style(10.5, 15, MUTED)).wrap(CW - 36, 1000)[1]
    height = title_h + status_h + body_h + 70
    c.setFillColor(bg)
    c.roundRect(M, y - height, CW, height, 10, fill=1, stroke=0)
    text_at(label, M + 18, y - 14, CW - 36, 12.2, accent, True, 17)
    text_at(status, M + 18, y - 20 - title_h, CW - 36, 10.4, leading=14.8)
    by = y - 27 - title_h - status_h
    text_at(body, M + 18, by, CW - 36, 10.5, MUTED, leading=15)
    button_y = y - height + 13
    button_w = min(CW - 36, pdfmetrics.stringWidth(action, "GuideSemi", 10.4) + 28)
    c.setFillColor(accent)
    c.roundRect(M + 18, button_y, button_w, 28, 7, fill=1, stroke=0)
    c.setFont("GuideSemi", 10.4)
    c.setFillColor(WHITE)
    c.drawString(M + 32, button_y + 9, action)
    y -= height + 14
    check()


# 1. Welcome and navigation.
new_page("Your interview journey,\nmade easier.",
         "A friendly guide to ITerview, your next steps, and the research behind them.",
         "Welcome", "S1-S6", "welcome")
callout("Start where you are.",
        "You do not need to understand the research statistics to use ITerview. "
        "Begin with your roadmap, practice speaking, and follow your next step.")
heading("What ITerview helps you practice")
p("ITerview helps graduating IT students explain their knowledge in a spoken interview. "
  "You answer questions out loud, receive feedback, and see how your interview responses "
  "and confidence change from your starting point.")
table(["If you are...", "Start here"], [
    ["<b>A new user</b>", "The big picture and your first assessment: pages 2-4."],
    ["<b>A returning user</b>", "Where to continue and what becomes available: pages 5-6."],
    ["<b>A researcher or team member</b>", "The four hypotheses: pages 7-10. Dashboard and build roadmap: pages 11-12."],
], [0.34, 0.66])
heading("Three labels you will see")
bullet("In the code:", "A feature or rule is present in the reviewed source. This is not a claim that every live scenario has passed testing.")
bullet("Planned:", "A proposed improvement, such as the journey tracker replacing Practice curriculum.")
bullet("Needs agreement:", "A rule differs between the research notes and the implementation, or still needs a defined procedure.")
callout("About this working guide", "Based on the project papers, hypothesis notes, and source reviewed on 12 September 2026. "
        "The system supplies evidence for testing the hypotheses; the statistician interprets the study results. "
        "This guide does not report research findings.", PALE_TEAL, TEAL)

# 2. A readable, vector flowchart.
new_page("Your journey at a glance", "One assessment journey collects two before-and-after comparisons.",
         "Your roadmap", "S2, S3, S5", "roadmap")
p("<b>Start:</b> Register or sign in, open the dashboard, and choose your target role "
  "(Frontend, Backend, or Fullstack).", gap=14)
phase("01 / Find your starting point", [
    "Confidence survey (pre): answer five self-rating items.",
    "Microphone setup: check that you can hear and be heard.",
    "Pre-test interview: answer five spoken questions.",
], "Saved: baseline confidence for H02 + baseline 3C scores for H01.", PALE_BLUE, BLUE, 146)
arrow(W / 2, y - 3, y - 19)
y -= 25
phase("02 / Practice through MainSets", [
    "Set 1: personalized practice around your 3C focus.",
    "Set 2: technical questions for your chosen role.",
    "Set 3: behavioral answers using the STAR approach.",
], "Five questions per set. Difficulty progression belongs within the intervention.", PALE_TEAL, TEAL, 146)
arrow(W / 2, y - 3, y - 19)
y -= 25
phase("03 / See what changed", [
    "Post-test interview: answer the same five assessment questions.",
    "Confidence survey (post): answer the same five items again.",
    "Results: compare response quality and confidence separately.",
], "Saved: final 3C scores for H01 + final confidence for H02.", PALE_VIOLET, VIOLET, 146)
y -= 15
p("<b>Then:</b> Return to the dashboard to view your report and continue optional practice. "
  "The statistician uses paired records across participants for the research analysis.", size=10.8)
p("<b>Needs agreement:</b> Difficulty progression and post-test timing. See page 12.",
  size=10.0, color=MUTED, gap=0)

# 3. New user baseline.
new_page("New here? Start with a baseline.", "Your first assessment gives you a starting point you can compare with later.",
         "New user / Part 1", "S1-S3, S5", "new-user")
step(1, "Choose the role you want to practice for.",
     "Pick Frontend, Backend, or Fullstack. This gives your technical practice a clear direction. "
     "A role is an interview context, not a separate research outcome.")
step(2, "Tell us how confident you feel today.",
     "Answer five confidence items on a 1-5 scale. Choose the response that best matches how you feel. "
     "There are no right or wrong confidence answers. This is your H02 starting measurement.")
step(3, "Check your microphone and audio.",
     "Choose your input device, check the volume, and listen to the interviewer voice. "
     "Use setup to get comfortable with the equipment before starting the assessment.")
step(4, "Take the pre-test interview.",
     "Answer five questions out loud using your current knowledge. The system records your answers "
     "and evaluates Clarity, Correctness, and Completeness. This is your H01 baseline.")
callout("A starting score is useful information.",
        "You are finding out what to work on. Give your own answers rather than rehearsing the assessment "
        "questions in advance. Practice comes after the baseline.", PALE_TEAL, TEAL)
heading("What becomes available after the pre-test?")
p("Your baseline can inform the progress view and Set 1 practice focus. "
  "The dashboard currently enables practice after the diagnostic. "
  "Medium and Hard are still conditional unlocks; completing the survey or pre-test alone does not earn them.")
p("<b>In the code:</b> Completed pre-test interviews are protected against normal retakes. "
  "The automatic flow continues into Set 1 after the pre-test analysis.", size=10.3, color=MUTED, gap=0)

# 4. MainSets and final measurements.
new_page("Practice, then check your growth.", "MainSets gives you three kinds of interview practice within the same journey.",
         "New user / Part 2", "S2, S3, S5, S6", "practice")
table(["Practice step", "What you work on"], [
    ["<b>Set 1 / Personalized</b><br/>5 questions", "Explaining concepts with your selected 3C focus. Auto focus uses the pre-test weakness in the current backend."],
    ["<b>Set 2 / Technical</b><br/>5 questions", "Reasoning through technical questions for your target role and difficulty. This set uses its own technical feedback dimensions."],
    ["<b>Set 3 / Behavioral</b><br/>5 questions", "Describing experiences using STAR: Situation, Task, Action, and Result. This set uses behavioral feedback dimensions."],
], [0.34, 0.66])
heading("A typical answer follows this rhythm")
callout("Listen > Speak > Review > Confirm > Continue", "Listen to the question, record your response, "
        "and review the transcript before confirming it for evaluation. "
        "Follow the feedback and next-question controls shown on the screen.")
heading("After the intervention")
step(1, "Take the post-test interview.",
     "Answer the same five assessment questions again. Your new 3C scores provide the final "
     "response-quality measurement for H01.", VIOLET)
step(2, "Complete the final confidence survey.",
     "Rate the same five confidence items again. This provides the final measurement for H02. "
     "The interview alone cannot measure your self-reported confidence.", VIOLET)
step(3, "Open your results.",
     "See your before-and-after interview scores and confidence ratings. "
     "You can reflect on what changed and return to the dashboard.", VIOLET)
p("<b>Keep the meanings separate:</b> Practice feedback helps you learn. "
  "H01 is measured with the pre/post interview 3Cs, and H02 with the pre/post confidence survey. "
  "A mixed practice average does not replace either comparison.", size=10.3, color=MUTED, gap=0)

# 5. Returning users.
new_page("Welcome back. Here is your next step.", "Being a returning user does not mean your assessment journey is already complete.",
         "Returning user", "S3, S5", "returning-user")
table(["Where you left off", "The intended next action"], [
    ["You have not saved the first confidence survey.", "<b>Start confidence survey.</b> Establish your starting measurement first."],
    ["The first survey is saved, but the pre-test is unfinished.", "<b>Continue setup or pre-test.</b> Keep your existing starting survey."],
    ["Your pre-test is complete, but MainSets is unfinished.", "<b>Continue your assessment.</b> Resume the correct set and remaining questions."],
    ["MainSets is complete, but the final interview or survey is missing.", "<b>Finish the missing final step.</b> Take the post-test, or complete the final confidence survey."],
    ["Both interviews and both surveys are complete.", "<b>View your comparison or keep practicing.</b> Use the difficulty levels you have earned."],
], [0.43, 0.57])
callout("Your dashboard should help you pick up where you stopped.",
        "Planned: show your current stage and one clear Continue button. "
        "The code already supports resuming interview sessions, but the dashboard needs a complete "
        "journey check across the surveys, interviews, and sets.", PALE_TEAL, TEAL)
heading("After your full assessment is complete")
bullet("Review your report.", "Look at the original pre/post comparison and feedback.")
bullet("Keep practicing.", "Start or resume optional practice using available role, focus, and difficulty settings.")
bullet("Keep your research measurements.", "In normal use, completed pre/post interviews are not retaken. "
       "Later practice should have its own history and should not replace the original assessment records.")
p("<b>In the code:</b> A practice-mode journey finishes at a practice summary after Set 3. "
  "An assessment-mode journey continues to the post-test. "
  "The planned Continue button must preserve the right mode.", size=10.2, color=MUTED, gap=0)

# 6. Unlocks.
new_page("What becomes available, and when?", "A difficulty unlock lets you choose a harder challenge. It is earned through performance.",
         "Progress and unlocks", "S2-S5", "unlocks")
box_gap = 14
box_w = (CW - 2 * box_gap) / 3
for idx, (name, body, bg, accent) in enumerate([
    ("Easy", "Your starting level", PALE_BLUE, BLUE),
    ("Medium", "Earned after Easy", PALE_TEAL, TEAL),
    ("Hard", "Earned after Medium", PALE_VIOLET, VIOLET),
]):
    x = M + idx * (box_w + box_gap)
    c.setFillColor(bg)
    c.roundRect(x, y - 79, box_w, 79, 10, fill=1, stroke=0)
    text_at(name, x + 13, y - 13, box_w - 26, 17, accent, True, 21)
    text_at(body, x + 13, y - 44, box_w - 26, 10.3, leading=14)
y -= 97
table(["Milestone", "What it means"], [
    ["<b>New account</b>", "Easy is the initial available difficulty. Choose a role and begin the first assessment."],
    ["<b>Baseline completed</b>", "Practice becomes available and your starting performance can appear in progress views. Higher difficulties still require mastery."],
    ["<b>Mastery requirement met</b>", "The next difficulty becomes available for selection. An unlock does not automatically switch your selected level."],
    ["<b>Full assessment completed</b>", "Your performance and confidence comparisons are available. Continued practice uses its own summary."],
], [0.35, 0.65])
heading("Current unlock logic in the code")
p("The results endpoint uses a <b>70% threshold</b>. In the assessment flow, "
  "both the practice-sets average and post-test score must meet it. In practice mode, "
  "the practice-sets average is used. Easy can unlock Medium; Medium can unlock Hard.")
callout("Needs agreement before the final student release", "The planning notes use 75%, "
        "while the backend uses 70%. Agree on one threshold and one rule for the required "
        "intervention duration. Also verify score calculations before treating an unlock as fully validated.",
        PALE_AMBER, AMBER)
p("<b>Set and level are different:</b> Set 1, Set 2, and Set 3 describe the kind of practice. "
  "Easy, Medium, and Hard describe the challenge level. A full three-set cycle has 15 questions.",
  size=10.4, color=MUTED, gap=0)

# 7. H01.
new_page("H01 / Did response quality improve?", "This hypothesis looks at what students say and how well they explain it.",
         "Research in plain language", "S1-S3, S5, R1", "h01")
callout("The null hypothesis", "There is no significant improvement in the quality of interview "
        "responses based on Clarity, Correctness, and Completeness before and after exposure to ITerview.")
p("<b>Clarity:</b> Can the interviewer follow your explanation?<br/>"
  "<b>Correctness:</b> Are your facts and technical ideas accurate?<br/>"
  "<b>Completeness:</b> Did you answer the whole question with enough detail?")
heading("How ITerview provides the evidence")
p("The system saves each pre-test and post-test question, transcript, and three separate "
  "3C scores under the same participant identity. The current implementation uses the same "
  "five questions in both assessments. These paired records allow a before-and-after comparison.")
heading("An example of a student comparison")
table(["Average score / 5", "Before", "After", "Change"], [
    ["Clarity", "3.0", "4.0", "+1.0"],
    ["Correctness", "3.4", "4.0", "+0.6"],
    ["Completeness", "2.8", "3.6", "+0.8"],
], [0.43, 0.19, 0.19, 0.19])
p("Illustrative averages only. These are not study findings.", size=9.7, color=MUTED, gap=10)
callout("Who does what?", "ITerview records scores and shows individual changes. "
        "The statistician analyzes paired participant data, using the approved tests "
        "(the paper lists a paired t-test or Wilcoxon signed-rank test). "
        "The study results determine the conclusion.", PALE_TEAL, TEAL)
p("<b>Team check:</b> Keep the pre/post scoring rubric and assessment conditions comparable. "
  "Report the 3Cs separately; do not substitute a combined practice or journey average for H01.",
  size=10.3, color=MUTED, gap=0)

# 8. H02.
new_page("H02 / Did confidence improve?", "Students rate how ready they feel before and after the interviews.",
         "Research in plain language", "S1-S3, S5, R1", "h02")
callout("The null hypothesis", "There is no significant improvement in confidence before "
        "and after exposure to ITerview.", PALE_VIOLET, VIOLET)
heading("How ITerview provides the evidence")
p("The same five confidence items are answered before the pre-test and again after the post-test. "
  "The system saves the item-level answers and a total score for each phase. "
  "The current code uses 1-5 responses, so five answered items produce a total from 5 to 25.")
p("<b>First survey:</b> before the intervention, for starting confidence.<br/>"
  "<b>Final survey:</b> after the post-test, for ending confidence.")
heading("An example of a confidence comparison")
callout("Before: 14 / 25     After: 19 / 25     Change: +5 points", "This means the "
        "student reported higher confidence at the end. The example is illustrative; a positive "
        "change for one student does not establish a significant study-wide improvement.", PALE_TEAL, TEAL)
bullet("Honest ratings are enough.", "The survey does not have right or wrong answers. Respond based on how you feel at that time.")
bullet("You need both surveys.", "A completed post-test interview does not replace the final confidence survey.")
bullet("Confidence and performance stay separate.", "A student can feel more confident while still having technical skills to improve.")
callout("Who does what?", "ITerview saves ratings and shows the before-and-after change. "
        "The statistician selects and checks the approved paired analysis across respondents. "
        "The AI does not infer the confidence survey score from the interview transcript.")
p("<b>Needs agreement:</b> Align the paper's agreement anchors with the screen's confidence anchors. "
  "Use one approved instrument in both phases.",
  size=10.3, color=MUTED, gap=0)

# 9. H03.
new_page("H03 / Are AI scores consistent?", "The answer stays the same. Only the evaluation is repeated.",
         "Research validation", "S2-S4, S6, R2, R3", "h03")
callout("The null hypothesis", "There is no significant difference in AI-generated scoring "
        "on student responses across multiple trials.", PALE_TEAL, TEAL)
step(1, "Select saved responses.", "Use the same question and verified answer in every trial.", TEAL)
step(2, "Repeat the evaluation.", "Notes propose three trials. Keep the model, prompt, rubric, and settings fixed and recorded.", TEAL)
step(3, "Export separate 3C scores.", "Link each score to its saved response and trial number.", TEAL)
step(4, "Statistician analyzes reliability.", "The paper lists repeated-measures ANOVA or Friedman for trial differences, plus ICC (Intraclass Correlation Coefficient) for reliability.", TEAL)
table(["Same saved answer", "Clarity", "Correctness", "Completeness"], [
    ["Trial 1", "4", "4", "3"],
    ["Trial 2", "4", "3", "3"],
    ["Trial 3", "4", "4", "3"],
], [0.34, 0.20, 0.23, 0.23], size=10.1)
p("Illustrative scores. Reliability is assessed across many saved responses.",
  size=9.7, color=MUTED, gap=9)
callout("The student does not need to answer three times.", "Trials reuse saved responses. "
        "Planned: a validation runner and CSV export. The AI supplies scores; "
        "the statistician computes and interprets ICC and the trial-comparison tests.")
p("<b>A useful distinction:</b> Similar trial averages alone do not establish reliability. "
  "The statistician also checks agreement and uncertainty.",
  size=10.1, color=MUTED, gap=0)

# 10. H04.
new_page("H04 / How do AI and HR ratings compare?", "This checks the AI scores against independent human evaluations of the same responses.",
         "Research validation", "S3, R2, R4", "h04")
callout("The null hypothesis", "There is no significant difference between AI-generated "
        "scores and HR specialist ratings when evaluating student responses based on the 3C's framework.",
        PALE_VIOLET, VIOLET)
callout("Scope status: needs agreement", "H04 appears in the project hypothesis notes. "
        "The supplied Chapter 1 and Chapter 3 files cover H01-H03 and do not define a full H04 procedure. "
        "Confirm H04 in the approved study scope before collecting its validation data.", PALE_AMBER, AMBER)
heading("A proposed validation workflow")
step(1, "Give both evaluators the same material.", "Use the same saved question and response, along with the same 3C rubric and score scale.", VIOLET)
step(2, "Collect independent HR ratings.", "HR specialists rate the responses. Keep their ratings independent of the AI scores so the comparison is meaningful.", VIOLET)
step(3, "Match and export the ratings.", "Link each AI score and HR score to the same response. Record the human rater identity using an appropriate code.", VIOLET)
step(4, "Ask the statistician to compare them.", "The statistician and adviser define the comparison and agreement analysis, including how multiple HR raters are handled.", VIOLET)
p("<b>AI:</b> supplies its 3C scores. <b>HR specialists:</b> provide human ratings. "
  "<b>Statistician:</b> analyzes differences and agreement using the approved protocol.")
p("<b>Planned:</b> A rubric-based HR rating form and paired export. "
  "The AI cannot stand in for a real HR specialist. Finding no significant difference alone "
  "does not establish that the scores are equivalent.", size=10.1, color=MUTED, gap=0)

# 11. Replacement dashboard proposal.
new_page("Replace curriculum with a clear journey.", "Planned dashboard examples: the next action changes as the student progresses.",
         "Dashboard roadmap", "S2, S3, S5", "dashboard-plan")
journey_example("New user / Find your starting point",
                "<b>Current:</b> First confidence survey<br/>Upcoming: Pre-test > MainSets > Final interview and survey > Results",
                "Start confidence survey",
                "Answer five short items about how ready you feel before your first interview.")
journey_example("Returning user / Continue your assessment",
                "<b>Completed:</b> First survey and pre-test<br/><b>Current:</b> MainSets, Set 2",
                "Continue Set 2",
                "Your baseline is saved. Pick up your role-based technical practice where you stopped.",
                PALE_TEAL, TEAL)
journey_example("Completed user / See your growth",
                "<b>Completed:</b> Both surveys, both interviews, and the required MainSets intervention",
                "View my comparison",
                "Review performance and confidence separately. Keep practicing with your available levels.",
                PALE_VIOLET, VIOLET)
heading("What belongs in this section?")
bullet("Your stage.", "Show Completed, Current, and Upcoming steps with short, familiar names.")
bullet("Your next action.", "Offer one primary Start, Continue, Finish, or View results button.")
bullet("Your available challenge.", "Show the selected difficulty and earned unlocks when practice is relevant.")
p("These are proposed examples, not screenshots of features already shipped. "
  "The existing Practice curriculum cards are presets for role, focus, or difficulty; "
  "they do not explain the complete assessment journey.", size=10.1, color=MUTED, gap=0)

# 12. Development sequence and unresolved rules.
new_page("Build the next features in this order.", "A practical team roadmap for the journey and research validation tools.",
         "Team checklist", "S1-S6", "build-roadmap")
table(["Order", "What to add or harden", "Ready when..."], [
    ["<b>1</b>", "Stage-aware continuation", "Signing back in resumes the correct unfinished stage and preserves assessment or practice mode."],
    ["<b>2</b>", "Your interview journey", "The dashboard shows real completion states and one next action, replacing the curriculum grid."],
    ["<b>3</b>", "Complete, stable comparisons", "Both interviews and surveys are present; original research records stay separate from later practice."],
    ["<b>4</b>", "Research exports + H03 runner", "Paired participant data and repeated trial scores can be handed to the statistician without rebuilding them manually."],
    ["<b>5</b>", "H04 human-rating workflow", "Scope, rubric, independent rating procedure, rater handling, and export are approved and implemented."],
], [0.10, 0.36, 0.54], size=10.0)
heading("Resolve these rules before publishing promises")
bullet("Mastery and duration.", "Reconcile 70% in the backend with 75% in notes. "
       "Define whether the research post-test follows one three-set cycle or the required Easy-Medium-Hard intervention.")
bullet("Confidence instrument.", "Align the paper's agreement anchors with the screen's confidence anchors. "
       "Keep the approved questions, response labels, and scoring identical before and after.")
bullet("Comparable scoring.", "Freeze the approved assessment rubric and difficulty. "
       "The pre/post controllers currently read the user's selected difficulty separately.")
bullet("Reliable records.", "Set 3 history converts an out-of-5 average with x10; results uses /5 x100. "
       "Reconcile the calculation before relying on unlocks. Flag failed evaluations separately from valid research scores.")
callout("Keep a complete research dataset", "Keep full attempt and response records for the study; "
        "visible practice history holds only 20 entries. Export coded participant IDs, original "
        "pre/post data, rubric versions, and repeated trials. Record missing or failed measurements explicitly.",
        PALE_TEAL, TEAL)

# 13. Glossary, evidence, sources.
new_page("Keep this page for quick reference.", "A few useful words, and where the guide's explanations come from.",
         "Reference", "", "references")
table(["Word", "Meaning in this guide"], [
    ["<b>Baseline</b>", "Your starting measurement before practice."],
    ["<b>Intervention</b>", "The interview practice provided through ITerview."],
    ["<b>Hypothesis / H0</b>", "A research statement tested with collected data. H0 is the null hypothesis."],
    ["<b>Paired data</b>", "Before and after measurements belonging to the same participant."],
    ["<b>ICC</b>", "Intraclass Correlation Coefficient: a statistic used to study score reliability."],
    ["<b>Mastery unlock</b>", "Permission to select the next difficulty after meeting the agreed performance requirement."],
], [0.29, 0.71], size=10.1)
heading("Project sources")
for label, body in [
    ("S1", "guide/papers/chap1.md: objectives and research questions."),
    ("S2", "guide/papers/chap3.md and chap3-measurements.md: study design, instruments, procedure, and statistical treatment."),
    ("S3", "guide/hypoCaps.md: H01-H04 wording and the proposed system sequence. H04 scope still needs confirmation."),
    ("S4", "guide/system-blueprint.md: assessment questions, proposed 75% mastery rule, and repeated-evaluation plan."),
    ("S5", "frontend/src/App.jsx, pages/Dashboard.jsx, LikertScale.jsx, PreTest.jsx, MainSets.jsx, PostTest.jsx, Results.jsx; components/MicTest.jsx: routes, student flow, and dashboard behavior."),
    ("S6", "backend/routes/userRoutes.js; models/User.js, PreTestSession.js, PostTestSession.js; controllers/interviewSocket.js, postTestSocket.js, set1Socket.js, set3Socket.js; services/aiEvaluator.js, aiSet2Generator.js, aiSet3Generator.js: storage, scoring, resume, unlocks, and build gaps."),
]:
    p(f"<b>{label}</b> {escape(body)}", size=9.3, color=MUTED, gap=6)
heading("Statistical references")
refs = [
    ("R1", "NIST: paired observations", "https://www.itl.nist.gov/div898/handbook/prc/section3/prc311.htm"),
    ("R2", "Koo and Li (2016): selecting and reporting ICC", "https://pubmed.ncbi.nlm.nih.gov/27330520/"),
    ("R3", "NIST: Friedman test", "https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/friedman.htm"),
    ("R4", "NIST TN 2106: comparing instruments and equivalence", "https://www.nist.gov/publications/comparing-instruments"),
]
for label, title, url in refs:
    p(f'<b>{label}</b> <link href="{escape(url)}" color="#2563EB">{escape(title)}</link>',
      size=9.4, gap=5)
p("The statistician and adviser finalize test assumptions, ICC specification, missing-data handling, "
  "and interpretation. No sample size, p-value, ICC value, or positive study result has been invented in this guide.",
  size=9.3, color=MUTED, gap=0)

check()
c.save()
print(f"Created {OUT}")
print(f"Pages: {page}")
print(f"Lowest checked layout position: {min(m[2] for m in measurements):.1f} pt")
print("Layout bottoms:", {key: round(value, 1) for key, value in layout_bottom.items()})
if any(value < 60 for value in layout_bottom.values()):
    raise RuntimeError("One or more pages need layout correction before delivery")
