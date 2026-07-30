# Build you-and-your-research/index.html from the extracted transcript.
# The transcript text is passed through verbatim (typographic quotes only);
# headings, pull quotes, and margin notes are editorial additions.
import json, html, re, sys

paras = json.load(open('paras.json'))
OUT = 'index.html'  # run from this folder: python3 build.py

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
  45: ("It ain’t what you do", "A swing-era song, written by Sy Oliver and Trummy Young in 1939."),
  69: ("Barney Oliver", "Barney Oliver ran Hewlett-Packard’s research labs for decades and later led NASA’s SETI program."),
  81: ("Ed David", "Ed David directed research at Bell Labs and later served as science advisor to President Nixon."),
  97: ("hamming window", "The Hamming window is a smoothing curve used throughout signal processing. This answer is the story of its name."),
  116: ("error-correcting codes", "Hamming codes, published in 1950, let a computer detect and repair corrupted bits on its own. Their descendants run in ECC memory, flash storage, and deep-space radio links."),
}
note_counter = [0]

def para_html(i, cls=None, label=None):
    consumed.add(i)
    body = render(paras[i])
    if label:
        name, kind = label
        body = re.sub(r'^<em>(.+?):</em>\s*', '', body)
        body = f'<span class="spk spk-{kind}">{name}</span> ' + body
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

# ---------- the talk: sections ----------
SECTIONS = [
 ("Why this talk",        [12,13,14,15,16,17], 16, "I have to get you to drop modesty and say to yourself, “Yes, I would like to do first-class work.”"),
 ("Luck, and the prepared mind", [18,19,20,21,22,23], 19, "Luck favors the prepared mind."),
 ("Courage",              [24], 24, "Once you get your courage up and believe that you can do important problems, then you can."),
 ("Age and fame",         [25,26,27], 27, "When you are famous it is hard to work on small problems."),
 ("Working conditions",   [28,29,30], 28, "What most people think are the best working conditions, are not."),
 ("Drive",                [31,32,33], 32, "Knowledge and productivity are like compound interest."),
 ("Ambiguity",            [34,35], 34, "Great scientists tolerate ambiguity very well."),
 ("Important problems",   [36,37,38,39,40,41,42,43], 39, "If you do not work on an important problem, it’s unlikely you’ll do important work."),
 ("The open door",        [44], 44, "He who works with the door open gets all kinds of interruptions, but he also occasionally gets clues as to what the world is and what might be important."),
 ("It’s the way you do it", [45,46,47,48,49], 47, "You should do your job in such a fashion that others can build on top of it."),
 ("Selling the work",     [50,51,52,53], 50, "It is not sufficient to do a job, you have to sell it."),
 ("Taking control",       [54,55,56,57], 54, "I deny that it is all luck, but I admit there is a fair element of luck."),
 ("Is it worth it?",      [58,59,60], 58, "The value is in the struggle more than it is in the result."),
 ("Fighting the system",  [61,62,63,64,65,66,67,68,69,70,71], 62, "Good scientists will fight the system rather than learn to work with the system."),
 ("Know yourself",        [72,73,74,75,76], 75, "You need to know yourself, your weaknesses, your strengths, and your bad faults."),
]

talk = []
for si,(title, idxs, pull_after, pull_text) in enumerate(SECTIONS, 1):
    sid = 's' + str(si)
    talk.append(f'<section id="{sid}">')
    talk.append(f'<h2><span class="secno">{si}</span>{title}</h2>')
    for j, i in enumerate(idxs):
        cls = 'dropcap' if i == 12 else None
        talk.append(para_html(i, cls))
        if i == pull_after:
            talk.append(pull(pull_text, pull_after))
    talk.append('</section>')
talk_html = '\n'.join(talk)

consumed.add(77)
end_talk = f'<p class="endmark">{render(paras[77])}</p>'

# ---------- Q&A ----------
qa = []
prev_kind = 'q'
for i in range(79, 110):
    consumed.add(i)
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
    for si,(t,_,_,_) in enumerate(SECTIONS,1))

page = f"""<!DOCTYPE html>
<!--
  You and Your Research · reading edition
  Full transcript of Richard Hamming's 1986 Bellcore colloquium talk.
  Text is verbatim from the J. F. Kaiser transcription (source in footer).
  Editorial layer: section headings, pull quotes, numbered margin notes, TOC,
  reading progress bar. Built from ../template/index.html tokens. Deps: none.
-->
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>You and Your Research · Richard Hamming</title>
<meta name="description" content="Richard Hamming’s 1986 talk on doing great research: the complete transcript, designed for reading, with margin notes.">
<style>
  :root{{
    --bg:#f7f3ec; --surface:#fffdf9; --fg:#26221c; --muted:#7a7264;
    --line:#e4dccd; --accent:#c8492e; --accent-2:#2e6ec8; --shade:rgba(200,73,46,.12);
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }}
  :root[data-theme="dark"]{{--bg:#151310;--surface:#1e1b16;--fg:#ece5da;--muted:#9c9284;--line:#332e26;--accent:#f0704f;--accent-2:#6ea3f0;--shade:rgba(240,112,79,.14)}}
  :root[data-theme="light"]{{--bg:#f7f3ec;--surface:#fffdf9;--fg:#26221c;--muted:#7a7264;--line:#e4dccd;--accent:#c8492e;--accent-2:#2e6ec8;--shade:rgba(200,73,46,.12)}}
  *{{box-sizing:border-box}} html{{-webkit-text-size-adjust:100%;scroll-behavior:smooth}}
  body{{margin:0;background:var(--bg);color:var(--fg);font-family:var(--serif);font-size:19px;line-height:1.62;-webkit-font-smoothing:antialiased}}
  main{{max-width:40rem;margin:0 auto;padding:1.25rem 1.15rem 5rem}}
  h1{{font-size:2.5rem;line-height:1.08;letter-spacing:-.01em;margin:.25em 0 .1em}}
  .dek{{font-family:var(--sans);color:var(--muted);font-size:1.02rem;line-height:1.45;margin:.4em 0 1.2em}}
  h2{{font-size:1.4rem;line-height:1.2;margin:2.4em 0 .3em;letter-spacing:-.01em}}
  p{{margin:.9em 0}} a{{color:var(--accent)}}
  .byline{{font-family:var(--sans);font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:2.2rem 0 0}}
  .ednote{{font-family:var(--sans);font-size:.82rem;color:var(--muted);line-height:1.5;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:.7rem 0;margin:0 0 1.6rem}}
  .secno{{display:block;font-family:var(--sans);font-weight:600;font-size:.75rem;letter-spacing:.14em;color:var(--accent);margin-bottom:.15rem}}
  .secno::before{{content:"§ "}}
  .pull{{font-family:var(--sans);font-weight:600;font-size:1.2rem;line-height:1.35;border-left:3px solid var(--accent);padding:.1rem 0 .1rem 1rem;margin:1.8em 0}}
  .dropcap::first-letter{{float:left;font-size:3.4em;line-height:.82;padding:.06em .08em 0 0;font-weight:600}}
  /* margin notes */
  section p, .qa p, .frontmatter p, .bio p{{position:relative}}
  .mnref{{font-family:var(--sans);font-weight:700;font-size:.68em;color:var(--accent);padding-left:.08em}}
  .mn{{display:block;font-family:var(--sans);font-size:.8rem;line-height:1.5;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:.55rem .75rem;margin:.8em 0 .2em}}
  .mn b{{color:var(--accent);font-weight:700;padding-right:.25em}}
  @media (min-width:1220px){{
    .mn{{position:absolute;top:0;left:100%;margin:0 0 0 2.6rem;width:15.5rem;background:none;border:none;border-left:2px solid var(--line);border-radius:0;padding:.1rem 0 .1rem .8rem}}
  }}
  /* contents */
  .toc{{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1rem 1.15rem 1.1rem;margin:1.8em 0;font-family:var(--sans)}}
  .toc h2{{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 .5em}}
  .toc ol{{margin:0;padding-left:1.3rem;font-size:.92rem;line-height:1.9;columns:2;column-gap:2rem}}
  .toc li::marker{{color:var(--muted);font-size:.8em}}
  .toc a{{text-decoration:none;color:var(--fg)}} .toc a:hover{{color:var(--accent)}}
  .toc .toc-extra{{list-style:none;padding-left:0;margin:.5rem 0 0;font-size:.92rem;line-height:1.9}}
  @media (max-width:560px){{.toc ol{{columns:1}}}}
  /* front matter */
  details.frontmatter{{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:0 1.15rem;margin:1em 0}}
  details.frontmatter summary{{font-family:var(--sans);font-size:.92rem;font-weight:600;padding:.8rem 0;cursor:pointer;color:var(--fg)}}
  details.frontmatter summary:hover{{color:var(--accent)}}
  details.frontmatter[open] summary{{border-bottom:1px solid var(--line)}}
  details.frontmatter p{{font-size:.95rem;color:var(--muted)}}
  details.frontmatter .mn{{position:static;margin:.8em 0;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:.55rem .75rem;width:auto}}
  /* Q&A */
  .spk{{font-family:var(--sans);font-weight:700;font-size:.78em;letter-spacing:.06em;text-transform:uppercase}}
  .spk-h{{color:var(--accent)}} .spk-q{{color:var(--accent-2)}}
  .qa-q{{color:var(--fg);font-style:italic;margin-top:1.6em}}
  .qa-q .spk{{font-style:normal}}
  .endmark{{font-family:var(--sans);font-size:.8rem;color:var(--muted);text-align:center;margin:2.5em 0}}
  .closing{{font-size:1.55rem;line-height:1.3;text-align:center;font-style:italic;margin:2em 0 1em}}
  .bio p{{font-size:.95rem;color:var(--muted)}}
  #prog{{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:20}}
  .themebtn{{position:fixed;top:.7rem;right:.7rem;z-index:10;font-family:var(--sans);font-size:.9rem;background:var(--surface);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.35rem .7rem;cursor:pointer}}
  footer{{font-family:var(--sans);font-size:.82rem;color:var(--muted);line-height:1.5;border-top:1px solid var(--line);margin-top:3rem;padding-top:1.1rem}}
  footer h2{{font-family:var(--sans);font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;margin:1.2em 0 .6em}}
  @media (prefers-reduced-motion: reduce){{*{{transition:none!important;animation:none!important}} html{{scroll-behavior:auto}}}}
</style>
</head>
<body>
<div id="prog" aria-hidden="true"></div>
<button class="themebtn" id="themebtn" aria-label="Toggle dark mode">◐ theme</button>
<main>
  <header>
    <p class="byline">Bell Communications Research Colloquium · March 7, 1986</p>
    <h1>You and Your Research</h1>
    <p class="dek">Richard Hamming’s talk on why so few scientists do work that matters, and how to be one of the ones who do. The complete transcript, set for reading.</p>
    <p class="ednote">Hamming’s words are verbatim from the J. F. Kaiser transcription. The section headings, pull quotes, and numbered notes are editorial additions of this edition.</p>
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
    <p>“You and Your Research,” a talk by Richard W. Hamming at the Bell Communications Research Colloquium, Morristown, New Jersey, March 7, 1986. Transcribed from tape by J. F. Kaiser, Bell Communications Research. Text reproduced in full from the <a href="https://www.cs.virginia.edu/~robins/YouAndYourResearch.html">copy hosted by Gabriel Robins</a> at the University of Virginia.</p>
    <p>{ack} —{ack_sig}</p>
    <p>This reading edition adds section headings, pull quotes (all verbatim from the surrounding text), and numbered margin notes. Notes sit in the right margin on wide screens and inline on small ones.</p>
  </footer>
</main>

<script>
(function(){{
  "use strict";
  document.getElementById("themebtn").addEventListener("click", function(){{
    var cur=document.documentElement.getAttribute("data-theme");
    var dark=cur?cur==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark?"light":"dark");
  }});
  var prog=document.getElementById("prog"), doc=document.documentElement;
  function upd(){{
    var max=doc.scrollHeight-window.innerHeight;
    prog.style.width=(max>0?(window.scrollY/max)*100:0)+"%";
  }}
  addEventListener("scroll", upd, {{passive:true}});
  addEventListener("resize", upd);
  upd();
}})();
</script>
</body>
</html>
"""

import os
if os.path.dirname(OUT): os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(page)
words = sum(len(p.split()) for p in paras)
print(f'wrote {OUT}: {len(page)} bytes, {words} source words, {note_counter[0]} notes, {len(SECTIONS)} sections')
