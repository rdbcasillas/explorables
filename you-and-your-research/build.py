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
import json, html, re, os

paras = json.load(open('paras.json'))
OUT = 'index.html'

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
}

# ---------- ELI5 popovers: para index -> [(anchor phrase, def key)] ----------
TERMS = {
  20: [("information theory", "infotheory"), ("coding theory", "codingtheory")],
  21: [("stationary local maximum", "localmax")],
  24: [("What would the average random code do?", "randomcode")],
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
    return f'<p{c}>{body}</p>'

def pull(text, after_para):
    # every pull quote must be verbatim from the paragraph it follows
    src = render(paras[after_para]).lower()
    probe = render(text).lower().rstrip('.”')
    probe_core = probe[0].lower() + probe[1:]
    assert probe_core[2:] in src, f'pull not verbatim (para {after_para}): {text}'
    return f'<p class="pull">{render(text)}</p>'

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
    54: "I deny that it is all luck, but I admit there is a fair element of luck."}),
 ("Is it worth it?", [58,59,60], {
    58: "The value is in the struggle more than it is in the result."}),
 ("Fighting the system", [61,62,63,64,65,66,67,68,69,70,71], {
    62: "Good scientists will fight the system rather than learn to work with the system."}),
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
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  :root[data-theme="dark"]{--bg:#151310;--surface:#1e1b16;--fg:#ece5da;--muted:#9c9284;--line:#332e26;--accent:#f0704f;--accent-2:#6ea3f0;--shade:rgba(240,112,79,.14)}
  :root[data-theme="light"]{--bg:#f7f3ec;--surface:#fffdf9;--fg:#26221c;--muted:#7a7264;--line:#e4dccd;--accent:#c8492e;--accent-2:#2e6ec8;--shade:rgba(200,73,46,.12)}
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
  <h2>You and Your Research</h2>
  <ol>
{drawer_rows}
  </ol>
</nav>
<main>
  <header>
    <p class="byline">Bell Communications Research Colloquium · March 7, 1986</p>
    <h1>You and Your Research</h1>
    <p class="dek">Richard Hamming’s talk on why so few scientists do work that matters, and how to be one of the ones who do. The complete transcript, set for reading.</p>
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
