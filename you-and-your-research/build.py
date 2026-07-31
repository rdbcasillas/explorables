# Build index.html from the extracted transcript (paras.json).
# Run from this folder: python3 build.py
#
# The transcript text is passed through verbatim (typographic quotes only).
# Editorial layer, all defined in the dicts below and verified against the
# source text by asserts at build time:
#   SECTIONS   - thematic headings + pull quotes (verbatim, keyed by paragraph)
#   HIGHLIGHTS - marker-underlined phrases inside paragraphs (verbatim)
#   NOTES      - numbered margin notes (right margin >=1220px, inline below)
#   TERMS      - click-to-open ELI5 popovers on jargon terms
import json, html, re, os, base64

paras = json.load(open('paras.json'))
OUT = 'index.html'

# hero photo, inlined as a data URI so the page stays a single file
with open('hamming-nps-office.jpg', 'rb') as f:
    HERO_URI = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()

# ---------- text rendering ----------
def render(text):
    t = html.escape(text, quote=False)
    t = t.replace('``', '“').replace("''", '”')
    t = t.replace('`', '‘').replace("'", '’')
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\*(.+?)\*', r'<em>\1</em>', t)
    return t

consumed = set()

# ---------- margin notes: para index -> (anchor phrase, note text) ----------
NOTES = {
  13: ("Los Alamos", "Los Alamos: the Manhattan Project’s secret weapons lab in New Mexico. Hamming ran the machines that did the bomb designers’ calculations."),
  14: ("Bode", "Hendrik Bode, of Bode-plot fame in control theory, headed the mathematics department Hamming joined at Bell Labs in 1946."),
  19: ("Pasteur", "Pasteur’s line comes from an 1854 lecture at Lille: in the fields of observation, chance favors only the prepared mind."),
  20: ("Shannon", "Claude Shannon founded information theory in 1948, while he and Hamming shared an office at Bell Labs."),
  23: ("John Pierce", "John Pierce led the Bell Labs teams behind Echo and Telstar, the first communications satellites, and coined the word “transistor.”"),
  30: ("Grace Hopper", "Grace Hopper: computing pioneer and Navy rear admiral. She wrote the first compiler and shaped COBOL."),
  31: ("John Tukey", "John Tukey, the Bell Labs and Princeton statistician: co-inventor of the fast Fourier transform, coiner of the words “bit” and “software.”"),
  36: ("Shockley, Brattain, Bardeen", "Shockley, Brattain and Bardeen invented the transistor at Bell Labs and shared the 1956 Nobel Prize for it: the prize Hamming mentions next."),
  37: ("What are the important problems of your field?", "This dining-hall question is still in circulation: researchers today call it “the Hamming question.”"),
  44: ("the door open", "A modern reading: the door is partly virtual now - which seminars you sit in, which people, groups, and preprints you follow. The tradeoff Hamming describes carries over."),
  45: ("It ain’t what you do", "A swing-era song, written by Sy Oliver and Trummy Young in 1939."),
  46: ("shoulders of giants", "Newton’s line comes from a 1675 letter to Robert Hooke: “If I have seen further it is by standing on the shoulders of giants.”"),
  55: ("Schelkunoff", "Sergei Schelkunoff: Bell Labs mathematician, a founder of electromagnetic waveguide theory."),
  57: ("BSTJ", "The Bell System Technical Journal, where Bell Labs published its research. Shannon’s information theory paper appeared in it in 1948."),
  63: ("590 Madison Avenue", "IBM’s New York headquarters. Bell Labs rented time on IBM machines there before it had computers of its own."),
  69: ("Barney Oliver", "Barney Oliver ran Hewlett-Packard’s research labs for decades and later led NASA’s SETI program."),
  81: ("Ed David", "Ed David directed research at Bell Labs and later served as science advisor to President Nixon."),
  97: ("hamming window", "The Hamming window is a smoothing curve used throughout signal processing. This answer is the story of its name."),
  116: ("error-correcting codes", "Hamming codes, published in 1950, let a computer detect and repair corrupted bits on its own. Their descendants run in ECC memory, flash storage, and deep-space radio links."),
}
note_counter = [0]

# ---------- marker-underlined phrases: para index -> [verbatim phrases] ----------
HIGHLIGHTS = {
  15: ["Why shouldn't you do significant things in this one life, however you define significant?"],
  19: ["The prepared mind sooner or later finds something important and does it."],
  22: ["Once he got well started, his shyness, his awkwardness, his inarticulateness, fell away and he became much more productive in many other ways."],
  23: ["One success brought him confidence and courage."],
  26: ["if you do some good work you will find yourself on all kinds of committees and unable to do any more work"],
  27: ["After information theory, what do you do for an encore?",
       "when you get early recognition it seems to sterilize you"],
  29: ["What appears to be a fault, often, by a change of viewpoint, turns out to be one of the greatest assets you can have."],
  30: ["So ideal working conditions are very strange. The ones you want aren't always the best ones for you."],
  32: ["the one person who manages day in and day out to get in one more hour of thinking will be tremendously more productive over a lifetime"],
  33: ["drive, misapplied, doesn't get you anywhere",
       "Just hard work is not enough - it must be applied sensibly."],
  34: ["Great contributions are rarely done by adding another decimal place."],
  35: ["Keep your subconscious starved so it has to work on *your* problem, so you can sleep peacefully and get the answer in the morning, free."],
  39: ["It's not the consequence that makes a problem important, it is that you have a reasonable attack."],
  45: ["By changing the problem slightly, I did important work rather than trivial work."],
  46: ["These days we stand on each other's feet!"],
  48: ["The business of abstraction frequently makes things simple."],
  49: ["It's just as easy to do a broad, general job as one very special case."],
  51: ["You have to learn to write clearly and well so that people will read it, you must learn to give reasonably formal talks, and you also must learn to give informal talks."],
  52: ["I realized I either had to learn to give speeches smoothly or I would essentially partially cripple my whole career."],
  53: ["Most of the time the audience wants a broad general talk and wants much more survey and background than the speaker is willing to give."],
  54: ["I committed 10% of my time trying to understand the bigger problems in the field"],
  57: ["You can educate your bosses. It's a hard job."],
  58: ["The success and fame are sort of dividends, in my opinion."],
  60: ["The people who do great work with less ability but who are committed to it, get more done that those who have great skill and dabble in it"],
  61: ["If you will learn to work with the system, you can go as far as the system will support you."],
  63: ["was I going to assert my ego and dress the way I wanted to and have it steadily drain my effort from my professional life, or was I going to appear to conform better?"],
  65: ["The *appearance of conforming* gets you a long way."],
  66: ["Or you can fight it steadily, as a small undeclared war, for the whole of your life."],
  68: ["He rose to be the President of Bell Laboratories."],
  70: ["Which do you want to be? The person who changes the system or the person who does first-class science?"],
  71: ["you cannot be original in one area without having originality in others"],
  72: ["Amusement, yes, anger, no."],
  73: ["I used my ego to make myself behave the way I wanted to. I bragged about something so I'd have to perform."],
  74: ["You can tell other people all the alibis you want. I don't mind. But to yourself try to be honest."],
}

# ---------- ELI5 popovers: para index -> [(anchor phrase, def key)] ----------
TERMS = {
  20: [("information theory", "infotheory"), ("coding theory", "codingtheory")],
  21: [("stationary local maximum", "localmax")],
  24: [("What would the average random code do?", "randomcode")],
  29: [("absolute binary", "absbinary")],
}
DEFS = {
  "infotheory": {
    "t": "Information theory",
    "b": "Shannon’s 1948 theory that made “information” measurable. It puts a number (the bit) on how much surprise a message carries, and proves hard limits: how far any message can be compressed, and how fast it can travel over a noisy line.",
    "u": "https://en.wikipedia.org/wiki/Information_theory", "l": "Wikipedia"},
  "codingtheory": {
    "t": "Coding theory",
    "b": "The craft of weaving extra bits into a message so the receiver can spot, and even fix, the errors that noise introduces. Hamming’s error-correcting codes were among its founding results.",
    "u": "https://en.wikipedia.org/wiki/Coding_theory", "l": "Wikipedia"},
  "localmax": {
    "t": "A frozen wave crest",
    "b": "A “stationary local maximum” here means a wave crest standing still. Maxwell’s equations say a light wave can never stand still - yet riding alongside a beam at the speed of light, a frozen crest is exactly what you would see. Einstein spotted the contradiction as a boy; special relativity grew out of resolving it.",
    "u": "https://en.wikipedia.org/wiki/Special_relativity", "l": "Special relativity"},
  "absbinary": {
    "t": "Absolute binary",
    "b": "Programming by writing raw machine instructions as numbers, with no assembler or compiler to help: every operation and memory address coded by hand. Hamming’s answer - make the machine write its own programs - was an early step toward automatic programming.",
    "u": "https://en.wikipedia.org/wiki/Machine_code", "l": "Machine code"},
  "randomcode": {
    "t": "Why this was daring",
    "b": "Engineers built codes one careful design at a time. Shannon skipped designing entirely: he averaged the error rate over every possible code and showed the average is good - so at least one excellent code must exist. He proved great codes are out there without ever constructing one.",
    "u": "https://en.wikipedia.org/wiki/Noisy-channel_coding_theorem", "l": "The noisy-channel coding theorem"},
}

def para_html(i, cls=None, label=None):
    consumed.add(i)
    body = render(paras[i])
    if label:
        name, kind = label
        body = re.sub(r'^<em>(.+?):</em>\s*', '', body)
        body = f'<span class="spk spk-{kind}">{name}</span> ' + body
    for phrase in HIGHLIGHTS.get(i, []):
        pr = render(phrase)
        assert pr in body, f'highlight not found in para {i}: {phrase}'
        body = body.replace(pr, f'<mark class="hl">{pr}</mark>', 1)
    for anchor, key in TERMS.get(i, []):
        ar = render(anchor)
        assert ar in body, f'term anchor not found in para {i}: {anchor}'
        assert key in DEFS, f'no definition for term key {key}'
        body = body.replace(ar, f'<button class="term" data-d="{key}" aria-expanded="false">{ar}</button>', 1)
    if i in NOTES:
        anchor, note = NOTES[i]
        anchor_r = render(anchor)
        assert anchor_r in body, f'anchor not found in para {i}: {anchor_r}'
        note_counter[0] += 1
        n = note_counter[0]
        body = body.replace(anchor_r, f'{anchor_r}<sup class="mnref">{n}</sup>', 1)
        body += f'<span class="mn" role="note"><b>{n}</b> {render(note)}</span>'
    c = f' class="{cls}"' if cls else ''
    return f'<p data-p="{i}"{c}>{body}</p>'

def pull(text, after_para):
    # every pull quote must be verbatim from the paragraph it follows
    src = render(paras[after_para]).lower()
    probe = render(text).lower().rstrip('.”')
    probe_core = probe[0].lower() + probe[1:]
    assert probe_core[2:] in src, f'pull not verbatim (para {after_para}): {text}'
    return f'<p class="pull">{render(text)}</p>'

# ---------- figures: editorial visuals inserted after a paragraph (and its pull) ----------
# Static SVGs are generated here in Python; the two interactive figures are drawn
# by the widget JS in SCRIPT below. All are schematics of Hamming's own claims,
# labeled as such in their captions.
import math

def _loop_panel(y0, title, quote, nodes, color):
    """One flywheel/trap panel: a dashed circle, arrowheads, nodes on the rim."""
    cx, cy, r = 180, y0 + 190, 80
    k = len(nodes)
    parts = [
        f'<text x="180" y="{y0+18}" text-anchor="middle" class="svgtitle" style="fill:{color}">{title}</text>',
        f'<text x="180" y="{y0+38}" text-anchor="middle" class="svgquote">{quote}</text>',
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" class="sline" stroke-width="1.5" stroke-dasharray="3 4"/>',
    ]
    for j in range(k):  # arrowheads at midpoints between nodes, clockwise
        th = math.radians(-90 + (j + 0.5) * 360 / k)
        x, y = cx + r * math.cos(th), cy + r * math.sin(th)
        rot = math.degrees(math.atan2(math.cos(th), -math.sin(th)))
        parts.append(f'<polygon points="7,0 -5,5 -5,-5" transform="translate({x:.1f},{y:.1f}) rotate({rot:.1f})" style="fill:{color}"/>')
    for j, lines in enumerate(nodes):
        th = math.radians(-90 + j * 360 / k)
        x, y = cx + r * math.cos(th), cy + r * math.sin(th)
        h = 24 + 15 * len(lines)
        parts.append(f'<rect x="{x-68:.1f}" y="{y-h/2:.1f}" width="136" height="{h}" rx="10" class="svgnode"/>')
        ty = y - (len(lines) - 1) * 7.5 + 4
        for li, line in enumerate(lines):
            parts.append(f'<text x="{x:.1f}" y="{ty + li*15:.1f}" text-anchor="middle" class="svgnodetext">{line}</text>')
    return ''.join(parts)

def _loop_svg(title, quote, nodes, color, aria):
    return (f'<svg class="narrow" viewBox="0 0 360 318" role="img" aria-label="{aria}">'
            + _loop_panel(8, title, quote, nodes, color) + '</svg>')

LOOP_CONFIDENCE = _loop_svg('The confidence flywheel', '“One success brought him confidence and courage.”',
    [['Courage'], ['Attempt an', 'important problem'], ['A success'], ['Confidence']], 'var(--accent-2)',
    'A loop: courage leads to attempting an important problem, to a success, to confidence, and back to courage.')
LOOP_KNOWLEDGE = _loop_svg('The knowledge flywheel', '“Knowledge and productivity are like compound interest.”',
    [['The more you know'], ['the more you can do'], ['the more opportunity', 'finds you']], 'var(--accent-2)',
    'A loop: the more you know, the more you can do, the more opportunity finds you, and back around.')
def _chain_svg(title, quote, nodes, color, aria):
    """A one-way vertical cascade: node, arrow down, node... last node dashed."""
    parts = [
        f'<text x="180" y="18" text-anchor="middle" class="svgtitle" style="fill:{color}">{title}</text>',
        f'<text x="180" y="38" text-anchor="middle" class="svgquote">{quote}</text>',
    ]
    y = 58
    for j, lines in enumerate(nodes):
        h = 24 + 15 * len(lines)
        last = j == len(nodes) - 1
        style = f'fill:none;stroke:{color};stroke-dasharray:5 4' if last else ''
        parts.append(f'<rect x="55" y="{y}" width="250" height="{h}" rx="10" class="svgnode"{f" style={chr(34)}{style}{chr(34)}" if style else ""}/>')
        ty = y + h / 2 - (len(lines) - 1) * 7.5 + 4
        for li, line in enumerate(lines):
            parts.append(f'<text x="180" y="{ty + li*15:.1f}" text-anchor="middle" class="svgnodetext">{line}</text>')
        y += h
        if not last:
            parts.append(f'<line x1="180" y1="{y+3}" x2="180" y2="{y+19}" style="stroke:{color}" stroke-width="1.5"/>')
            parts.append(f'<polygon points="180,{y+24} 175,{y+16} 185,{y+16}" style="fill:{color}"/>')
            y += 26
    return (f'<svg class="narrow" viewBox="0 0 360 {y+10}" role="img" aria-label="{aria}">'
            + ''.join(parts) + '</svg>')

CHAIN_TRAP = _chain_svg('The fame trap', '“When you get early recognition it seems to sterilize you.”',
    [['Do good work'], ['Recognition'], ['Committees, and only', '“great” problems'], ['No little acorns', 'planted'], ['Nothing new grows']], 'var(--accent)',
    'A one-way cascade: good work brings recognition, which brings committees and only great problems, so no little acorns are planted and nothing new grows.')

QUAD_SVG = '''<svg class="narrow" viewBox="0 0 360 340" role="img" aria-label="Two-by-two chart: consequence if solved versus having a reasonable attack.">
  <line x1="50" y1="288" x2="340" y2="288" class="sline" stroke-width="1.5"/>
  <polygon points="340,288 331,284 331,292" class="smutedfill"/>
  <line x1="50" y1="288" x2="50" y2="28" class="sline" stroke-width="1.5"/>
  <polygon points="50,28 46,37 54,37" class="smutedfill"/>
  <line x1="195" y1="284" x2="195" y2="32" class="sline" stroke-dasharray="2 5"/>
  <line x1="54" y1="158" x2="336" y2="158" class="sline" stroke-dasharray="2 5"/>
  <text x="195" y="316" text-anchor="middle" class="svgaxis">a reasonable attack →</text>
  <text x="26" y="158" text-anchor="middle" class="svgaxis" transform="rotate(-90 26 158)">consequence if solved →</text>
  <text x="122" y="80" text-anchor="middle" class="svgnodetext">Time travel, teleportation,</text>
  <text x="122" y="96" text-anchor="middle" class="svgnodetext">antigravity</text>
  <text x="122" y="114" text-anchor="middle" class="svgsub">“not important problems,</text>
  <text x="122" y="127" text-anchor="middle" class="svgsub">because we do not have an attack”</text>
  <circle cx="268" cy="72" r="5" style="fill:var(--accent)"/>
  <text x="268" y="94" text-anchor="middle" class="svgnodetext" style="fill:var(--accent);font-weight:700">Important problems</text>
  <text x="268" y="110" text-anchor="middle" class="svgsub">consequence, and</text>
  <text x="268" y="123" text-anchor="middle" class="svgsub">a way to attack it</text>
  <text x="268" y="212" text-anchor="middle" class="svgnodetext">Safe little problems</text>
  <text x="268" y="230" text-anchor="middle" class="svgsub">where the average scientist</text>
  <text x="268" y="243" text-anchor="middle" class="svgsub">“spends almost all his time”</text>
  <text x="122" y="222" text-anchor="middle" class="svgsub">(nothing for you here)</text>
</svg>'''

FIG_HTML = {
 'compound': '''<figure class="fig" id="fig-compound">
  <div class="control">
    <label for="ci-e"><span>Extra effort, day in and day out</span><span class="val" id="ci-e-val">+2%</span></label>
    <input type="range" id="ci-e" min="2" max="20" value="2">
    <p class="fighint" id="ci-hint">→ Drag the slider: add a little more daily effort and watch the gap open.</p>
  </div>
  <svg id="ci-svg" viewBox="0 0 680 320" role="img" aria-label="Compounding capability versus the flat intuition, over a forty-year career."></svg>
  <p class="figread" id="ci-read"></p>
  <figcaption>Hamming’s compound-interest claim, drawn literally: capability that multiplies each year, against the flat “10% in, 10% out” intuition. A schematic of his metaphor, not a measurement.</figcaption>
</figure>''',
 'quad': '''<figure class="fig" id="fig-quad">''' + QUAD_SVG + '''
  <figcaption>His definition of “important,” drawn as a plane. The examples are his own, from this section: importance needs both axes, and consequence alone puts nothing in the upper right.</figcaption>
</figure>''',
 'loop-confidence': '''<figure class="fig" id="fig-loop-confidence">''' + LOOP_CONFIDENCE + '''
  <figcaption>The loop inside this section’s stories. Pfann and Clogston each got one success, and it began to spin. Schematic; the quote is Hamming’s.</figcaption>
</figure>''',
 'loop-knowledge': '''<figure class="fig" id="fig-loop-knowledge">''' + LOOP_KNOWLEDGE + '''
  <figcaption>The sentence behind the chart above, drawn as the loop it is: each turn multiplies the next.</figcaption>
</figure>''',
 'loop-trap': '''<figure class="fig" id="fig-loop-trap">''' + CHAIN_TRAP + '''
  <figcaption>Not a flywheel: a one-way slide, redrawn from his description in this section. The recognition stays; the new work stops. What he says did Shannon in.</figcaption>
</figure>''',
}
FIGURES = {24: 'loop-confidence', 27: 'loop-trap', 32: 'compound',
           33: 'loop-knowledge', 39: 'quad'}

# ---------- the talk: sections; pulls keyed by the paragraph they follow ----------
SECTIONS = [
 ("Why this talk", [12,13,14,15,16,17], {
    13: "I wanted to know why they were so different from me.",
    16: "I have to get you to drop modesty and say to yourself, “Yes, I would like to do first-class work.”"}),
 ("Luck, and the prepared mind", [18,19,20,21,22,23], {
    19: "Luck favors the prepared mind."}),
 ("Courage", [24], {
    24: "Once you get your courage up and believe that you can do important problems, then you can."}),
 ("Age and fame", [25,26,27], {
    27: "They fail to continue to plant the little acorns from which the mighty oak trees grow."}),
 ("Working conditions", [28,29,30], {
    28: "What most people think are the best working conditions, are not."}),
 ("Drive", [31,32,33], {
    31: "You would be surprised Hamming, how much you would know if you worked as hard as he did that many years.",
    32: "Knowledge and productivity are like compound interest."}),
 ("Ambiguity", [34,35], {
    34: "Great scientists tolerate ambiguity very well."}),
 ("Important problems", [36,37,38,39,40,41,42,43], {
    37: "If what you are doing is not important, and if you don’t think it is going to lead to something important, why are you at Bell Labs working on it?",
    39: "If you do not work on an important problem, it’s unlikely you’ll do important work."}),
 ("The open door", [44], {
    44: "He who works with the door open gets all kinds of interruptions, but he also occasionally gets clues as to what the world is and what might be important."}),
 ("It’s the way you do it", [45,46,47,48,49], {
    47: "You should do your job in such a fashion that others can build on top of it."}),
 ("Selling the work", [50,51,52,53], {
    50: "It is not sufficient to do a job, you have to sell it."}),
 ("Taking control", [54,55,56,57], {
    54: "I deny that it is all luck, but I admit there is a fair element of luck.",
    55: "You set your deadlines; you can change them."}),
 ("Is it worth it?", [58,59,60], {
    58: "The value is in the struggle more than it is in the result."}),
 ("Fighting the system", [61,62,63,64,65,66,67,68,69,70,71], {
    62: "Good scientists will fight the system rather than learn to work with the system.",
    70: "Very few of you have the ability to both reform the system *and* become a first-class scientist."}),
 ("Know yourself", [72,73,74,75,76], {
    75: "You need to know yourself, your weaknesses, your strengths, and your bad faults."}),
]

talk = []
for si, (title, idxs, pulls) in enumerate(SECTIONS, 1):
    assert set(pulls) <= set(idxs), f'pull outside section: {title}'
    talk.append(f'<section id="s{si}">')
    talk.append(f'<h2><span class="secno">{si}</span>{title}</h2>')
    for i in idxs:
        talk.append(para_html(i, 'dropcap' if i == 12 else None))
        if i in pulls:
            talk.append(pull(pulls[i], i))
        if i in FIGURES:
            talk.append(FIG_HTML[FIGURES[i]])
    talk.append('</section>')
talk_html = '\n'.join(talk)

consumed.add(77)
end_talk = f'<p class="endmark">{render(paras[77])}</p>'

# ---------- Q&A ----------
qa = []
prev_kind = 'q'
for i in range(79, 110):
    raw = paras[i]
    m = re.match(r'\*(?P<name>[^*]+):\*', raw)
    if m:
        name = m.group('name')
        kind = 'h' if name == 'Hamming' else 'q'
        disp = 'Hamming' if kind == 'h' else ('Chynoweth' if 'Chynoweth' in name else 'Question')
        qa.append(para_html(i, 'qa-' + kind, (disp, kind)))
        prev_kind = kind
    else:
        qa.append(para_html(i, f'qa-{prev_kind} qa-cont'))
qa_html = '\n'.join(qa)

consumed.add(110); consumed.add(111)
closing = f'<p class="closing">{render(paras[110])}</p>\n<p class="endmark">{render(paras[111])}</p>'

# ---------- front matter, bio, acknowledgement ----------
for i in (0,1,2,5,11,78,112,118):  # headers/title lines replaced by page structure
    consumed.add(i)
preface = '\n'.join(para_html(i) for i in (3,4))
introd  = '\n'.join(para_html(i) for i in (6,7,8,9,10))
bio     = '\n'.join(para_html(i) for i in (113,114,115,116,117))
ack     = render(paras[119]); consumed.add(119)
ack_sig = render(paras[120]); consumed.add(120)

missing = set(range(len(paras))) - consumed
assert not missing, f'paragraphs not placed: {sorted(missing)}'

toc_rows = '\n'.join(
    f'<li><a href="#s{si}">{t}</a></li>'
    for si, (t, _, _) in enumerate(SECTIONS, 1))
drawer_rows = '\n'.join(
    f'<li><a href="#s{si}"><span class="dnum">{si}</span>{t}</a></li>'
    for si, (t, _, _) in enumerate(SECTIONS, 1)) + '''
<li><a href="#discussion"><span class="dnum">Q&amp;A</span>The discussion</a></li>
<li><a href="#about-hamming"><span class="dnum">Bio</span>About Richard Hamming</a></li>'''

# ---------- page assembly (CSS and JS as plain strings; only the body is an f-string) ----------
CSS = """
  :root{
    --bg:#f7f3ec; --surface:#fffdf9; --fg:#26221c; --muted:#7a7264;
    --line:#e4dccd; --accent:#c8492e; --accent-2:#2e6ec8; --shade:rgba(200,73,46,.12);
    --shade2:rgba(46,110,200,.10);
    --umark:rgba(255,213,79,.45); --umark-line:rgba(197,155,20,.8);
    --sticky:#fdf6cd; --sticky-line:#e8dc9e;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  :root[data-theme="dark"]{--bg:#151310;--surface:#1e1b16;--fg:#ece5da;--muted:#9c9284;--line:#332e26;--accent:#f0704f;--accent-2:#6ea3f0;--shade:rgba(240,112,79,.14);--shade2:rgba(110,163,240,.14);--umark:rgba(255,213,79,.24);--umark-line:rgba(224,190,80,.55);--sticky:#37311c;--sticky-line:#4d4527}
  :root[data-theme="light"]{--bg:#f7f3ec;--surface:#fffdf9;--fg:#26221c;--muted:#7a7264;--line:#e4dccd;--accent:#c8492e;--accent-2:#2e6ec8;--shade:rgba(200,73,46,.12);--shade2:rgba(46,110,200,.10);--umark:rgba(255,213,79,.45);--umark-line:rgba(197,155,20,.8);--sticky:#fdf6cd;--sticky-line:#e8dc9e}
  *{box-sizing:border-box} html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--serif);font-size:19px;line-height:1.62;-webkit-font-smoothing:antialiased}
  main{max-width:40rem;margin:0 auto;padding:1.25rem 1.15rem 5rem}
  h1{font-size:2.5rem;line-height:1.08;letter-spacing:-.01em;margin:.25em 0 .1em}
  .dek{font-family:var(--sans);color:var(--muted);font-size:1.02rem;line-height:1.45;margin:.4em 0 1.2em}
  h2{font-size:1.4rem;line-height:1.2;margin:2.4em 0 .3em;letter-spacing:-.01em}
  p{margin:.9em 0} a{color:var(--accent)}
  .byline{font-family:var(--sans);font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:2.2rem 0 0}
  .ednote{font-family:var(--sans);font-size:.82rem;color:var(--muted);line-height:1.5;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:.7rem 0;margin:0 0 1.6rem}
  .secno{display:block;font-family:var(--sans);font-weight:600;font-size:.75rem;letter-spacing:.14em;color:var(--accent);margin-bottom:.15rem}
  .secno::before{content:"§ "}
  .pull{font-family:var(--sans);font-weight:600;font-size:1.2rem;line-height:1.35;border-left:3px solid var(--accent);padding:.1rem 0 .1rem 1rem;margin:1.8em 0}
  .dropcap::first-letter{float:left;font-size:3.4em;line-height:.82;padding:.06em .08em 0 0;font-weight:600}
  mark.hl{background:linear-gradient(to top,var(--shade) 0 .5em,transparent .5em);color:inherit;padding:0 .05em}
  /* ELI5 popover terms */
  .term{font:inherit;color:inherit;background:none;border:none;padding:0;cursor:pointer;border-bottom:2px dotted var(--accent-2);text-align:inherit}
  .term:hover,.term[aria-expanded="true"]{color:var(--accent-2)}
  .pop{position:absolute;z-index:50;width:min(21rem,calc(100vw - 1.6rem));background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);padding:.85rem 1rem;font-family:var(--sans);line-height:1.5}
  .pop h3{margin:0 0 .35rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-2)}
  .pop p{margin:0 0 .45rem;font-size:.85rem}
  .pop a{font-weight:600;font-size:.8rem}
  /* margin notes */
  section p, .qa p, .frontmatter p, .bio p{position:relative}
  .mnref{font-family:var(--sans);font-weight:700;font-size:.68em;color:var(--accent);padding-left:.08em}
  .mn{display:block;font-family:var(--sans);font-size:.8rem;line-height:1.5;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:.55rem .75rem;margin:.8em 0 .2em}
  .mn b{color:var(--accent);font-weight:700;padding-right:.25em}
  @media (min-width:1220px){
    .mn{position:absolute;top:0;left:100%;margin:0 0 0 2.6rem;width:15.5rem;background:none;border:none;border-left:2px solid var(--line);border-radius:0;padding:.1rem 0 .1rem .8rem}
  }
  /* contents card */
  .toc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1rem 1.15rem 1.1rem;margin:1.8em 0;font-family:var(--sans)}
  .toc h2{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 .5em}
  .toc ol{margin:0;padding-left:1.3rem;font-size:.92rem;line-height:1.9;columns:2;column-gap:2rem}
  .toc li::marker{color:var(--muted);font-size:.8em}
  .toc a{text-decoration:none;color:var(--fg)} .toc a:hover{color:var(--accent)}
  .toc .toc-extra{list-style:none;padding-left:0;margin:.5rem 0 0;font-size:.92rem;line-height:1.9}
  @media (max-width:560px){.toc ol{columns:1}}
  /* index drawer */
  .tocbtn{position:fixed;bottom:1rem;left:1rem;z-index:30;font-family:var(--sans);font-size:.88rem;background:var(--surface);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.55rem .9rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  .tocbtn:hover{color:var(--accent)}
  .scrim{position:fixed;inset:0;background:rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:opacity .2s;z-index:35}
  .scrim.show{opacity:1;pointer-events:auto}
  .drawer{position:fixed;top:0;bottom:0;left:0;width:min(19rem,86vw);background:var(--surface);border-right:1px solid var(--line);z-index:40;transform:translateX(-102%);transition:transform .22s ease;overflow-y:auto;padding:1.3rem 1.2rem;font-family:var(--sans)}
  .drawer.open{transform:translateX(0)}
  .drawer h2{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 .8em}
  .drawer ol{list-style:none;margin:0;padding:0;font-size:.92rem;line-height:2.05}
  .drawer a{display:block;color:var(--fg);text-decoration:none;padding:.05rem .55rem;border-radius:8px;border-left:3px solid transparent}
  .drawer a:hover{color:var(--accent)}
  .drawer a.cur{border-left-color:var(--accent);background:var(--shade);font-weight:600}
  .drawer .dnum{color:var(--muted);font-size:.72em;padding-right:.55em;text-transform:uppercase;letter-spacing:.05em}
  /* wide screens: the drawer becomes an always-visible left rail */
  @media (min-width:1220px){
    .tocbtn{display:none}
    .scrim{display:none!important}
    .drawer{transform:none;transition:none;top:5.5rem;bottom:auto;max-height:calc(100vh - 7rem);
      left:calc(50vw - 35.5rem);width:13.5rem;background:transparent;border:none;padding:0;overflow-y:auto}
    .drawer h2{margin-bottom:.6em}
    .drawer ol{font-size:.8rem;line-height:1.55}
    .drawer a{padding:.22rem .5rem;color:var(--muted)}
    .drawer a:hover{color:var(--accent)}
    .drawer a.cur{color:var(--fg)}
  }
  /* front matter */
  details.frontmatter{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:0 1.15rem;margin:1em 0}
  details.frontmatter summary{font-family:var(--sans);font-size:.92rem;font-weight:600;padding:.8rem 0;cursor:pointer;color:var(--fg)}
  details.frontmatter summary:hover{color:var(--accent)}
  details.frontmatter[open] summary{border-bottom:1px solid var(--line)}
  details.frontmatter p{font-size:.95rem;color:var(--muted)}
  details.frontmatter .mn{position:static;margin:.8em 0;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:.55rem .75rem;width:auto}
  /* Q&A */
  .spk{font-family:var(--sans);font-weight:700;font-size:.78em;letter-spacing:.06em;text-transform:uppercase}
  .spk-h{color:var(--accent)} .spk-q{color:var(--accent-2)}
  .qa-q{color:var(--fg);font-style:italic;margin-top:1.6em}
  .qa-q .spk{font-style:normal}
  /* figures */
  .hero{margin:1.6rem 0 0}
  .hero img{display:block;width:100%;height:auto;border-radius:14px}
  .hero figcaption{font-family:var(--sans);font-size:.78rem;color:var(--muted);margin-top:.5rem}
  .fig{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1.05rem 1rem 1.15rem;margin:1.8em 0}
  .fig figcaption{font-family:var(--sans);font-size:.82rem;color:var(--muted);line-height:1.45;margin-top:.7rem}
  .fig svg{display:block;width:100%;height:auto}
  .fig svg.narrow{max-width:23rem;margin:0 auto}
  .figread{font-family:var(--sans);font-size:.9rem;line-height:1.45;margin:.6rem 0 0;font-variant-numeric:tabular-nums}
  .control{font-family:var(--sans);margin:.2rem 0 .8rem}
  .control label{display:flex;justify-content:space-between;align-items:baseline;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}
  .control .val{font-variant-numeric:tabular-nums;font-size:1.05rem;text-transform:none;letter-spacing:0;color:var(--fg);font-weight:600}
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:34px;margin:0;background:transparent;cursor:pointer}
  input[type=range]:focus{outline:none}
  input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:var(--line)}
  input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:var(--line)}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;margin-top:-10px;border-radius:50%;background:var(--accent);border:3px solid var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.25)}
  input[type=range]::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:var(--accent);border:3px solid var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.25)}
  input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px var(--shade)}
  .fighint{font-family:var(--sans);font-size:.85rem;color:var(--accent);margin:.1rem 0 .4rem;transition:opacity .4s}
  .fighint.done{opacity:0}
  /* reader annotations */
  .uline{background:var(--umark);border-bottom:2px solid var(--umark-line);cursor:pointer}
  .unote{display:block;font-family:var(--sans);font-size:.85rem;line-height:1.5;color:var(--fg);background:var(--sticky);border:1px solid var(--sticky-line);border-radius:3px 12px 12px 12px;padding:.55rem .7rem;margin:.8em 0 .2em;white-space:pre-wrap}
  .unote .ux{float:right;font-family:var(--sans);background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.05rem;line-height:1;padding:0 0 .2rem .5rem}
  .unote .ux:hover{color:var(--accent)}
  .seltool{position:fixed;z-index:60;display:flex;gap:.15rem;background:var(--fg);border-radius:10px;padding:.28rem .3rem;box-shadow:0 6px 20px rgba(0,0,0,.3)}
  .seltool button{font-family:var(--sans);font-size:.85rem;background:none;border:none;color:var(--bg);padding:.3rem .6rem;cursor:pointer;border-radius:7px;white-space:nowrap}
  .seltool button:hover{background:rgba(255,255,255,.18)}
  .noteedit{position:absolute;z-index:60;width:min(19rem,calc(100vw - 1.6rem));background:var(--sticky);border:1px solid var(--sticky-line);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:.7rem;font-family:var(--sans)}
  .noteedit textarea{width:100%;min-height:4.2rem;border:1px solid var(--sticky-line);border-radius:8px;background:var(--surface);color:var(--fg);font-family:var(--sans);font-size:.9rem;padding:.5rem;resize:vertical}
  .noteedit .row{display:flex;justify-content:flex-end;gap:.4rem;margin-top:.45rem}
  .noteedit button{font-family:var(--sans);font-size:.85rem;border-radius:8px;padding:.35rem .7rem;cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--fg)}
  .noteedit button.pri{background:var(--accent);border-color:var(--accent);color:#fff}
  .marksbtn{position:fixed;bottom:1rem;right:1rem;z-index:30;font-family:var(--sans);font-size:.88rem;background:var(--surface);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.55rem .9rem;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  .marksbtn:hover{color:var(--accent)}
  .notepanel{position:fixed;bottom:3.7rem;right:1rem;z-index:45;width:min(20rem,calc(100vw - 2rem));background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.18);padding:1rem 1.1rem;font-family:var(--sans);display:none}
  .notepanel.open{display:block}
  .notepanel h2{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 .5em}
  .notepanel p{font-size:.85rem;line-height:1.5;color:var(--muted);margin:.4em 0}
  .notepanel .row{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem}
  .notepanel button{font-family:var(--sans);font-size:.85rem;border-radius:8px;padding:.4rem .7rem;cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--fg)}
  .notepanel button:hover{border-color:var(--accent);color:var(--accent)}
  /* svg building blocks (theme-aware via CSS vars) */
  .sline{stroke:var(--line)} .smutedfill{fill:var(--muted)}
  .svgtitle{font-family:var(--sans);font-size:14.5px;font-weight:700}
  .svgquote{font-family:var(--serif);font-style:italic;font-size:11.5px;fill:var(--muted)}
  .svgnode{fill:var(--bg);stroke:var(--line)}
  .svgnodetext{font-family:var(--sans);font-size:12px;fill:var(--fg)}
  .svgsub{font-family:var(--sans);font-size:10.5px;fill:var(--muted)}
  .svgaxis{font-family:var(--sans);font-size:11.5px;fill:var(--muted)}
  .svgtick{font-family:var(--sans);font-size:15px;fill:var(--muted)}
  .svglab{font-family:var(--sans);font-size:16.5px;fill:var(--muted)}
  .endmark{font-family:var(--sans);font-size:.8rem;color:var(--muted);text-align:center;margin:2.5em 0}
  .closing{font-size:1.55rem;line-height:1.3;text-align:center;font-style:italic;margin:2em 0 1em}
  .bio p{font-size:.95rem;color:var(--muted)}
  #prog{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:20}
  .themebtn{position:fixed;top:.7rem;right:.7rem;z-index:10;font-family:var(--sans);font-size:.9rem;background:var(--surface);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.35rem .7rem;cursor:pointer}
  footer{font-family:var(--sans);font-size:.82rem;color:var(--muted);line-height:1.5;border-top:1px solid var(--line);margin-top:3rem;padding-top:1.1rem}
  footer h2{font-family:var(--sans);font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;margin:1.2em 0 .6em}
  @media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important} html{scroll-behavior:auto}}
"""

SCRIPT = """
(function(){
  "use strict";
  document.getElementById("themebtn").addEventListener("click", function(){
    var cur=document.documentElement.getAttribute("data-theme");
    var dark=cur?cur==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark?"light":"dark");
  });

  /* progress bar + current-section tracking */
  var prog=document.getElementById("prog"), doc=document.documentElement;
  var dlinks=[].slice.call(document.querySelectorAll("#drawer a"));
  function currentSection(){
    var y=window.scrollY+120, cur=null;
    for(var i=0;i<dlinks.length;i++){
      var el=document.getElementById(dlinks[i].getAttribute("href").slice(1));
      if(el && el.offsetTop<=y) cur=dlinks[i];
    }
    for(var j=0;j<dlinks.length;j++) dlinks[j].classList.toggle("cur", dlinks[j]===cur);
  }
  function upd(){
    var max=doc.scrollHeight-window.innerHeight;
    prog.style.width=(max>0?(window.scrollY/max)*100:0)+"%";
    currentSection();
  }
  addEventListener("scroll", upd, {passive:true});
  addEventListener("resize", upd);
  upd();

  /* index drawer */
  var drawer=document.getElementById("drawer"), scrim=document.getElementById("scrim"),
      tocbtn=document.getElementById("tocbtn");
  function setDrawer(open){
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
    tocbtn.setAttribute("aria-expanded", open?"true":"false");
  }
  tocbtn.addEventListener("click", function(){ setDrawer(!drawer.classList.contains("open")); });
  scrim.addEventListener("click", function(){ setDrawer(false); });
  drawer.addEventListener("click", function(e){ if(e.target.closest("a")) setDrawer(false); });

  /* ELI5 popovers */
  var DEFS=__DEFS__;
  var pop=null, popFor=null;
  function closePop(){
    if(pop){ pop.remove(); pop=null; }
    if(popFor){ popFor.setAttribute("aria-expanded","false"); popFor=null; }
  }
  document.addEventListener("click", function(e){
    var t=e.target.closest(".term");
    if(!t){ if(pop && !e.target.closest(".pop")) closePop(); return; }
    if(popFor===t){ closePop(); return; }
    closePop();
    var d=DEFS[t.getAttribute("data-d")];
    pop=document.createElement("div"); pop.className="pop"; pop.setAttribute("role","note");
    var h=document.createElement("h3"); h.textContent=d.t;
    var b=document.createElement("p"); b.textContent=d.b;
    pop.appendChild(h); pop.appendChild(b);
    if(d.u){ var a=document.createElement("a"); a.href=d.u; a.target="_blank"; a.rel="noopener";
      a.textContent=d.l+" ↗"; pop.appendChild(a); }
    document.body.appendChild(pop);
    var r=t.getBoundingClientRect(), w=pop.offsetWidth;
    var x=Math.min(Math.max(10, r.left), doc.clientWidth-w-10);
    pop.style.left=(x+window.scrollX)+"px";
    pop.style.top=(r.bottom+window.scrollY+8)+"px";
    popFor=t; t.setAttribute("aria-expanded","true");
  });
  addEventListener("keydown", function(e){
    if(e.key==="Escape"){ closePop(); setDrawer(false); }
  });
  addEventListener("scroll", function(){ if(pop) closePop(); }, {passive:true});

  /* ---------- figure toolkit ---------- */
  function svgEl(tag, attrs){
    var el=document.createElementNS("http://www.w3.org/2000/svg", tag);
    for(var k in (attrs||{})) el.setAttribute(k, attrs[k]);
    return el;
  }
  function clearNode(n){ while(n.firstChild) n.removeChild(n.firstChild); }
  function txt(x, y, s, cls, anchor, style){
    var t=svgEl("text", {x:x, y:y, "class":cls||"svglab"});
    if(anchor) t.setAttribute("text-anchor", anchor);
    if(style) t.setAttribute("style", style);
    t.textContent=s; return t;
  }

  /* ---------- compound interest (§6) ---------- */
  (function(){
    var svg=document.getElementById("ci-svg"); if(!svg) return;
    var slider=document.getElementById("ci-e"), val=document.getElementById("ci-e-val"),
        read=document.getElementById("ci-read");
    var X0=64, X1=660, Y0=282, Y1=36, YMAX=4;   // plot area; y covers 1x..4x
    function X(t){ return X0+(X1-X0)*t/40; }
    function Y(v){ return Y0-(Y0-Y1)*(v-1)/(YMAX-1); }
    function draw(){
      var e=(+slider.value)/100;
      val.textContent="+"+slider.value+"%";
      clearNode(svg);
      var g=1+e, i, t, v;
      for(i=1;i<=YMAX;i++){
        svg.appendChild(svgEl("line",{x1:X0,y1:Y(i),x2:X1,y2:Y(i),"class":"sline","stroke-width":i===1?1.5:1,"stroke-dasharray":i===1?"":"2 5"}));
        svg.appendChild(txt(X0-8, Y(i)+5, i+"\\u00d7", "svgtick", "end"));
      }
      for(i=0;i<=40;i+=10) svg.appendChild(txt(X(i), Y0+22, i?("year "+i):"0", "svgtick", "middle"));
      // compound curve + shaded gap vs the flat intuition
      var pts=[], gap=["M"+X(0)+" "+Y(g).toFixed(1)];
      for(t=0;t<=40.01;t+=0.5){
        v=Math.pow(g,t); if(v>YMAX){ pts.push([X(t),Y(YMAX)]); break; }
        pts.push([X(t),Y(v)]);
      }
      var tEnd=(pts[pts.length-1][0]-X0)/(X1-X0)*40;
      var d="M"+pts.map(function(p){return p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" L ");
      svg.appendChild(svgEl("path",{d:d+" L "+X(tEnd).toFixed(1)+" "+Y(Math.min(g,YMAX)).toFixed(1)+" L "+X0+" "+Y(g).toFixed(1)+" Z",
        fill:"var(--shade)",stroke:"none"}));
      svg.appendChild(svgEl("line",{x1:X0,y1:Y(g),x2:X1,y2:Y(g),style:"stroke:var(--muted)","stroke-width":2,"stroke-dasharray":"7 5"}));
      svg.appendChild(svgEl("path",{d:d,fill:"none",style:"stroke:var(--accent)","stroke-width":3,"stroke-linecap":"round"}));
      svg.appendChild(txt(X1, Y(g)-8, "the intuition: +"+slider.value+"%", "svgtick", "end"));
      svg.appendChild(txt(X0+8, Y1+16, "capability, compounding", "svgtick", "start", "fill:var(--accent);font-weight:600"));
      // doubling marker
      var t2=Math.log(2)/Math.log(g);
      if(t2<=40){
        svg.appendChild(svgEl("line",{x1:X(t2),y1:Y(2),x2:X(t2),y2:Y0,style:"stroke:var(--accent)","stroke-width":1.5,"stroke-dasharray":"3 4"}));
        svg.appendChild(svgEl("circle",{cx:X(t2),cy:Y(2),r:5,style:"fill:var(--accent)"}));
        svg.appendChild(txt(X(t2)+8, Y(2)-10, "2\\u00d7 by year "+Math.round(t2), "svgtick", "start", "fill:var(--fg);font-weight:600"));
      }
      var v40=Math.pow(g,40);
      read.textContent="At +"+slider.value+"% a day, capability doubles by year "+Math.round(t2)+
        " - and taken literally the metaphor gives "+(v40>=100?"hundreds of times":"about "+Math.round(v40)+"\\u00d7")+
        " by year 40. The flat intuition expected 1."+(slider.value<10?"0":"")+slider.value+"\\u00d7, forever.";
    }
    slider.addEventListener("input", draw); draw();
    var hint=document.getElementById("ci-hint"), hinted=false;
    slider.addEventListener("input", function(){
      if(!hinted && hint){ hinted=true; hint.classList.add("done"); }
    });
  })();

  /* ---------- reader marks: underline + sticky notes, saved locally ---------- */
  (function(){
    var KEY="yayr-marks-v1";
    var marks=[];
    try{ var st=JSON.parse(localStorage.getItem(KEY)||"[]"); if(Array.isArray(st)) marks=st; }catch(err){}
    var btn=document.getElementById("marksbtn"), panel=document.getElementById("notepanel"),
        fileIn=document.getElementById("marksfile");
    function badge(){ btn.textContent="✎ "+marks.length; }
    function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(marks)); }catch(err){} badge(); }
    function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

    function pEl(pid){ return document.querySelector('p[data-p="'+pid+'"]'); }
    function textNodes(root){
      var w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, out=[];
      while((n=w.nextNode())) out.push(n);
      return out;
    }
    function offsetOf(p, node, off){
      if(node.nodeType!==3) return -1;
      var nodes=textNodes(p), sum=0;
      for(var i=0;i<nodes.length;i++){
        if(nodes[i]===node) return sum+off;
        sum+=nodes[i].nodeValue.length;
      }
      return -1;
    }
    function unwrap(el){
      var par=el.parentNode;
      while(el.firstChild) par.insertBefore(el.firstChild, el);
      par.removeChild(el);
    }
    function renderP(pid){
      var p=pEl(pid); if(!p) return;
      [].slice.call(p.querySelectorAll(".uline")).forEach(unwrap);
      [].slice.call(p.querySelectorAll(".unote")).forEach(function(n){ n.parentNode.removeChild(n); });
      p.normalize();
      var list=marks.filter(function(m){ return m.p===pid; });
      list.forEach(function(m){
        var guard=0;
        while(guard++<300){
          var nodes=textNodes(p), sum=0, wrapped=false;
          for(var i=0;i<nodes.length;i++){
            var n=nodes[i], len=n.nodeValue.length, ns=sum; sum+=len;
            if(!len) continue;
            if(n.parentNode.closest(".unote")) continue;
            if(n.parentNode.closest('[data-aid="'+m.id+'"]')) continue;
            var s=Math.max(m.s, ns), e=Math.min(m.e, ns+len);
            if(s>=e) continue;
            var r=document.createRange();
            r.setStart(n, s-ns); r.setEnd(n, e-ns);
            var span=document.createElement("span");
            span.className="uline"; span.setAttribute("data-aid", m.id);
            try{ r.surroundContents(span); }catch(err){ return; }
            wrapped=true; break;
          }
          if(!wrapped) break;
        }
      });
      list.forEach(function(m){
        if(!m.note) return;
        var card=document.createElement("span"); card.className="unote";
        var x=document.createElement("button"); x.className="ux"; x.textContent="×";
        x.setAttribute("aria-label","Remove this mark"); x.setAttribute("data-aid", m.id);
        card.appendChild(x);
        card.appendChild(document.createTextNode(m.note));
        p.appendChild(card);
      });
    }
    function renderAll(){
      var seen={};
      marks.forEach(function(m){ if(!seen[m.p]){ seen[m.p]=1; renderP(m.p); } });
    }
    function removeMark(id){
      var hit=null;
      marks=marks.filter(function(m){ if(m.id===id){ hit=m; return false; } return true; });
      persist(); if(hit) renderP(hit.p);
    }

    /* selection toolbar */
    var tool=document.createElement("div"); tool.className="seltool"; tool.style.display="none";
    var bU=document.createElement("button"); bU.textContent="Underline";
    var bN=document.createElement("button"); bN.textContent="Add note";
    tool.appendChild(bU); tool.appendChild(bN); document.body.appendChild(tool);
    var pending=null, selTimer=null;
    function hideTool(){ tool.style.display="none"; pending=null; }
    function checkSelection(){
      var sel=window.getSelection();
      if(!sel || sel.isCollapsed || !sel.rangeCount){ hideTool(); return; }
      var r=sel.getRangeAt(0);
      function host(node){ var el=node.nodeType===3?node.parentNode:node; return el && el.closest ? el.closest("p[data-p]") : null; }
      var pa=host(r.startContainer), pb=host(r.endContainer);
      if(!pa || pa!==pb){ hideTool(); return; }
      var s=offsetOf(pa, r.startContainer, r.startOffset), e=offsetOf(pa, r.endContainer, r.endOffset);
      if(s<0||e<0){ hideTool(); return; }
      if(e<s){ var t=s; s=e; e=t; }
      if(e-s<1){ hideTool(); return; }
      pending={p:+pa.getAttribute("data-p"), s:s, e:e};
      tool.style.display="flex";
      var rect=r.getBoundingClientRect(), tw=tool.offsetWidth;
      var x=Math.min(Math.max(8, rect.left+rect.width/2-tw/2), innerWidth-tw-8);
      var y=rect.top-tool.offsetHeight-10;
      if(y<8) y=rect.bottom+10;
      tool.style.left=x+"px"; tool.style.top=y+"px";
    }
    document.addEventListener("selectionchange", function(){
      clearTimeout(selTimer); selTimer=setTimeout(checkSelection, 200);
    });
    addEventListener("scroll", function(){ tool.style.display="none"; }, {passive:true});
    function commit(note){
      if(!pending) return;
      var m={id:newId(), p:pending.p, s:pending.s, e:pending.e};
      if(note) m.note=note;
      marks.push(m); persist(); renderP(m.p);
      var sel=window.getSelection(); if(sel) sel.removeAllRanges();
      hideTool();
    }
    bU.addEventListener("pointerdown", function(ev){ ev.preventDefault(); commit(null); });
    bN.addEventListener("pointerdown", function(ev){
      ev.preventDefault();
      if(!pending) return;
      var keep=pending;
      tool.style.display="none";
      var sel=window.getSelection(); if(sel) sel.removeAllRanges();
      openEditor(keep);
    });

    /* sticky-note editor */
    var editor=null;
    function closeEditor(){ if(editor){ editor.remove(); editor=null; } }
    function openEditor(target){
      closeEditor();
      editor=document.createElement("div"); editor.className="noteedit";
      var ta=document.createElement("textarea"); ta.placeholder="Your note…";
      var row=document.createElement("div"); row.className="row";
      var bc=document.createElement("button"); bc.textContent="Cancel";
      var bs=document.createElement("button"); bs.textContent="Save note"; bs.className="pri";
      row.appendChild(bc); row.appendChild(bs);
      editor.appendChild(ta); editor.appendChild(row);
      document.body.appendChild(editor);
      var rect=pEl(target.p).getBoundingClientRect();
      editor.style.left=(rect.left+window.scrollX)+"px";
      editor.style.top=(rect.bottom+window.scrollY+6)+"px";
      ta.focus();
      bc.addEventListener("click", closeEditor);
      bs.addEventListener("click", function(){
        var v=ta.value.trim();
        if(v){ pending=target; commit(v); }
        closeEditor();
      });
    }

    /* click an underline or a note's x */
    document.addEventListener("click", function(ev){
      var x=ev.target.closest(".unote .ux");
      if(x){ removeMark(x.getAttribute("data-aid")); return; }
      var u=ev.target.closest(".uline");
      if(u){
        var id=u.getAttribute("data-aid"), m=null;
        marks.forEach(function(mm){ if(mm.id===id) m=mm; });
        if(m && confirm(m.note ? "Remove this underline and its note?" : "Remove this underline?")) removeMark(id);
      }
    });

    /* manager panel */
    btn.addEventListener("click", function(){ panel.classList.toggle("open"); });
    document.getElementById("marks-dl").addEventListener("click", function(){
      var blob=new Blob([JSON.stringify({v:1, piece:"you-and-your-research", marks:marks}, null, 1)], {type:"application/json"});
      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob); a.download="you-and-your-research-marks.json";
      document.body.appendChild(a); a.click(); a.remove();
    });
    document.getElementById("marks-restore").addEventListener("click", function(){ fileIn.click(); });
    fileIn.addEventListener("change", function(){
      var f=fileIn.files && fileIn.files[0]; if(!f) return;
      var rd=new FileReader();
      rd.onload=function(){
        try{
          var data=JSON.parse(rd.result);
          var list=Array.isArray(data)?data:(data && Array.isArray(data.marks)?data.marks:null);
          if(!list) throw new Error("bad file");
          var touched={}; marks.forEach(function(m){ touched[m.p]=1; });
          marks=list.filter(function(m){ return m && typeof m.p==="number" && typeof m.s==="number" && typeof m.e==="number" && m.e>m.s; })
                    .map(function(m){ return {id:String(m.id||newId()), p:m.p, s:m.s, e:m.e,
                                              note:(typeof m.note==="string" && m.note) ? m.note : undefined}; });
          marks.forEach(function(m){ touched[m.p]=1; });
          persist();
          Object.keys(touched).forEach(function(pid){ renderP(+pid); });
          panel.classList.remove("open");
        }catch(err){ alert("Could not read that file - it doesn't look like a marks file from this page."); }
        fileIn.value="";
      };
      rd.readAsText(f);
    });
    document.getElementById("marks-clear").addEventListener("click", function(){
      if(!marks.length) return;
      if(confirm("Remove all "+marks.length+" of your marks from this browser?")){
        var pids={}; marks.forEach(function(m){ pids[m.p]=1; });
        marks=[]; persist();
        Object.keys(pids).forEach(function(pid){ renderP(+pid); });
        panel.classList.remove("open");
      }
    });
    addEventListener("keydown", function(ev){
      if(ev.key==="Escape"){ hideTool(); closeEditor(); panel.classList.remove("open"); }
    });
    badge(); renderAll();
  })();
})();
"""

page = f"""<!DOCTYPE html>
<!--
  You and Your Research · reading edition
  Full transcript of Richard Hamming's 1986 Bellcore colloquium talk.
  Text is verbatim from the J. F. Kaiser transcription (source in footer).
  Editorial layer (headings, pull quotes, highlights, margin notes, ELI5
  popovers, TOC + index drawer, progress bar) is defined in build.py and
  verified against the source text at build time. Deps: none.
-->
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>You and Your Research · Richard Hamming</title>
<meta name="description" content="Richard Hamming’s 1986 talk on doing great research: the complete transcript, designed for reading, with margin notes.">
<style>{CSS}</style>
</head>
<body>
<div id="prog" aria-hidden="true"></div>
<button class="themebtn" id="themebtn" aria-label="Toggle dark mode">◐ theme</button>
<button class="tocbtn" id="tocbtn" aria-expanded="false" aria-controls="drawer">§ Contents</button>
<div class="scrim" id="scrim"></div>
<nav class="drawer" id="drawer" aria-label="Section index">
  <h2>Contents</h2>
  <ol>
{drawer_rows}
  </ol>
</nav>
<button class="marksbtn" id="marksbtn" aria-controls="notepanel">✎ 0</button>
<div class="notepanel" id="notepanel">
  <h2>Your marks</h2>
  <p>Select any passage to underline it or attach a note. Your marks live only in this browser.</p>
  <p>Download them to keep a copy; restore the file later to bring them back.</p>
  <div class="row">
    <button id="marks-dl">Download</button>
    <button id="marks-restore">Restore from file</button>
    <button id="marks-clear">Clear all</button>
  </div>
</div>
<input type="file" id="marksfile" accept="application/json,.json" style="display:none">
<main>
  <header>
    <p class="byline">Bell Communications Research Colloquium · March 7, 1986</p>
    <h1>You and Your Research</h1>
    <p class="dek">Richard Hamming’s talk on why so few scientists do work that matters, and how to be one of the ones who do. The complete transcript, set for reading.</p>
    <figure class="hero">
      <img src="{HERO_URI}" alt="Richard Hamming in his office at the Naval Postgraduate School: white-haired, in a red plaid jacket and tie, beside a typewriter and stacks of papers." width="800" height="480">
      <figcaption>Richard Hamming in his office at the Naval Postgraduate School, Monterey, 1980s. U.S. Navy photo.</figcaption>
    </figure>
    <p class="ednote">Hamming’s words are verbatim from the J. F. Kaiser transcription. The section headings, pull quotes, highlights, and numbered notes are editorial additions of this edition. Dotted-underlined terms open a short plain-language explanation.</p>
  </header>

  <details class="frontmatter">
    <summary>Transcriber’s preface · J. F. Kaiser, Bellcore</summary>
    {preface}
  </details>
  <details class="frontmatter">
    <summary>Introduction of Dr. Hamming · Alan G. Chynoweth</summary>
    {introd}
  </details>

  <nav class="toc" aria-label="Contents">
    <h2>The talk</h2>
    <ol>
{toc_rows}
    </ol>
    <ul class="toc-extra">
      <li><a href="#discussion">Questions and answers</a></li>
      <li><a href="#about-hamming">About Richard Hamming</a></li>
    </ul>
  </nav>

{talk_html}

{end_talk}

<section id="discussion" class="qa">
<h2><span class="secno">Q &amp; A</span>The discussion</h2>
{qa_html}
{closing}
</section>

<section id="about-hamming" class="bio">
<h2>About Richard Hamming</h2>
{bio}
</section>

  <footer>
    <h2>Source &amp; colophon</h2>
    <p>“You and Your Research,” a talk by Richard W. Hamming at the Bell Communications Research Colloquium, Morristown, New Jersey, March 7, 1986. Transcribed from tape by J. F. Kaiser, Bell Communications Research. Text reproduced in full from the <a href="https://www.cs.virginia.edu/~robins/YouAndYourResearch.html">copy hosted by Gabriel Robins</a> at the University of Virginia.</p>
    <p>{ack} —{ack_sig}</p>
    <p>This reading edition adds section headings, pull quotes and highlights (all verbatim from the surrounding text), numbered margin notes, and plain-language popovers on a few technical terms. Notes sit in the right margin on wide screens and inline on small ones.</p>
    <p>Photo: Richard Hamming in his NPS office, circa 1980s. <a href="https://nps.edu/-/iconic-researcher-teacher-richard-hamming-maintains-lasting-legacy-on-campus">Naval Postgraduate School</a>; public domain as a work of the U.S. federal government.</p>
  </footer>
</main>

<script>{SCRIPT.replace('__DEFS__', json.dumps(DEFS, ensure_ascii=False))}</script>
</body>
</html>
"""

if os.path.dirname(OUT):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(page)
words = sum(len(p.split()) for p in paras)
n_pulls = sum(len(p) for _, _, p in SECTIONS)
n_hl = sum(len(v) for v in HIGHLIGHTS.values())
print(f'wrote {OUT}: {len(page)} chars, {words} source words, '
      f'{len(SECTIONS)} sections, {n_pulls} pulls, {note_counter[0]} notes, '
      f'{n_hl} highlights, {sum(len(v) for v in TERMS.values())} terms')
