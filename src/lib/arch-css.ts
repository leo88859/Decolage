// Feuille des architectures : site public (6 compositions d'accueil) et cadres de l'espace utilisateur
// (board, ledger, course, split, studio, store). Partagée par les aperçus et le projet Next.js exporté.
export const ARCH_CSS = `
body.mode-site,body.mode-app{display:block}body.mode-app.frame-split{display:flex}
.site-h{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:24px;padding:14px 40px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--ln)}
.site-h .brand{padding:0;cursor:pointer}.site-h nav{display:flex;gap:4px;margin-right:auto}
.site-h nav a{padding:8px 12px;border-radius:99px;color:var(--mut);font-weight:600;cursor:pointer}.site-h nav a.on,.site-h nav a:hover{color:var(--ink);background:var(--sf2)}
.b.ghost-l{background:none;border-color:transparent;box-shadow:none}
.site-main{max-width:1180px;margin:0 auto;padding:0 40px 60px}
.site-f{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:32px 40px;border-top:1px solid var(--ln);background:var(--sf)}.site-f a{color:var(--mut);cursor:pointer;margin-right:14px}
.lead{font-size:19px;color:var(--mut);max-width:620px}
.h-centre{text-align:center;padding:80px 0 40px;display:grid;justify-items:center;gap:18px}
.h-centre h1,.h-split h1,.hb-main h1{font-size:clamp(38px,6vw,64px);letter-spacing:-.04em;line-height:1.02;max-width:900px}
.h-centre .mock-app{margin-top:30px;width:min(860px,100%)}
.h-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;padding:40px 0}
.hf{padding:22px;border-radius:var(--r);background:var(--sf);border:var(--bd);display:grid;gap:6px}
.hf-n{font-weight:800;color:var(--p);font-size:13px;letter-spacing:.1em}
.h-split{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;padding:72px 0 40px}.h-split .lead{margin:16px 0 26px}
.h-ed{padding:90px 0 40px;border-bottom:1px solid var(--ink)}.h-ed h1{font-size:clamp(46px,8vw,104px);line-height:.95;letter-spacing:-.045em;margin:18px 0 30px;max-width:1000px}
.h-ed-cols{display:grid;grid-template-columns:1fr auto;gap:30px;align-items:end}
.h-ed-list{display:grid;padding:20px 0}.h-ed-list .hf{grid-template-columns:70px 1fr 1.4fr;align-items:baseline;border:0;border-bottom:1px solid var(--ln);border-radius:0;background:none;padding:22px 0}.h-ed-list .hf-n{font-size:28px;font-weight:500}
.h-quote{padding:60px 0;text-align:center}.h-quote p{font-size:clamp(24px,3vw,36px);max-width:820px;margin:0 auto;font-style:italic}
.h-bento{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(150px,auto);gap:14px;padding:50px 0}
.hb-main{grid-column:span 2;grid-row:span 2;padding:34px;border-radius:calc(var(--r)*1.6);background:var(--sf);border:var(--bd);display:grid;gap:14px;align-content:center}
.hb-tile{padding:22px;border-radius:calc(var(--r)*1.6);background:var(--sf);border:var(--bd);display:grid;gap:6px;align-content:end}
.hb-tile.t0{background:var(--p);color:#fff}.hb-tile.t0 p{color:rgba(255,255,255,.82)}.hb-tile.t1{background:color-mix(in srgb,var(--a) 22%,var(--sf))}
.hb-tile.t-app{grid-column:span 2;padding:10px;align-content:stretch}.hb-tile.t-num .big{font-size:48px}
.h-asym{display:grid;grid-template-columns:1.3fr .7fr;gap:24px 40px;padding:70px 0 30px}
.h-asym h1{grid-column:1/-1;font-size:clamp(48px,9vw,120px);line-height:.9;letter-spacing:-.05em;text-transform:uppercase}
.h-asym h1 span{background:linear-gradient(transparent 62%,var(--a) 62%)}
.h-asym-side{grid-column:2;grid-row:2;display:grid;gap:18px;align-content:start}.h-asym-mock{grid-column:1;grid-row:2;transform:rotate(-2deg);margin-top:24px}
.h-asym-feats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:50px 0}.h-asym-feats .hf:nth-child(2){transform:translateY(30px)}.h-asym-feats .hf:nth-child(3){transform:translateY(-10px) rotate(1deg)}
.h-term{padding:60px 0}.term-win{background:#0b0f19;color:#d1fae5;border-radius:12px;padding:26px 30px;font:15px/1.8 ui-monospace,"JetBrains Mono",Consolas,monospace;box-shadow:0 30px 80px -40px #000;border:1px solid #1e293b}
.term-win h1{font:700 clamp(28px,4vw,46px)/1.15 ui-monospace,"JetBrains Mono",monospace;color:#fff;margin:12px 0}.term-win .ok{color:#4ade80}.term-win .term-h{display:flex;gap:6px;margin-bottom:14px}.term-win .term-h i{width:11px;height:11px;border-radius:50%;background:#f43f5e}.term-win .term-h i:nth-child(2){background:#f59e0b}.term-win .term-h i:nth-child(3){background:#22c55e}
.mock-app{border-radius:14px;overflow:hidden;background:var(--sf);border:var(--bd);box-shadow:0 30px 70px -40px rgba(15,23,42,.5);text-align:left}
.mock-bar{display:flex;gap:6px;align-items:center;padding:9px 12px;background:var(--sf2);font-size:12px;color:var(--mut)}.mock-bar i{width:9px;height:9px;border-radius:50%;background:var(--ln)}.mock-bar span{margin-left:8px}
.mock-body{display:grid;grid-template-columns:150px 1fr;min-height:200px}
.mock-nav{padding:12px;display:grid;gap:4px;align-content:start;border-right:1px solid var(--ln)}.mock-nav span{padding:6px 9px;border-radius:8px;font-size:12.5px;color:var(--mut)}.mock-nav span.on{background:color-mix(in srgb,var(--p) 14%,transparent);color:var(--p);font-weight:700}
.mock-rows{padding:14px;display:grid;gap:8px;align-content:start}.mock-rows div{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;background:var(--sf2);font-size:13px}
.mock-app.frame-ledger .mock-body,.mock-app.frame-course .mock-body,.mock-app.frame-store .mock-body,.mock-app.frame-studio .mock-body{grid-template-columns:1fr}
.mock-app.frame-ledger .mock-nav,.mock-app.frame-course .mock-nav,.mock-app.frame-store .mock-nav,.mock-app.frame-studio .mock-nav{display:flex;border-right:0;border-bottom:1px solid var(--ln)}
.mock-app.frame-split .mock-body{grid-template-columns:44px 1fr}.mock-app.frame-split .mock-nav{background:var(--ink)}.mock-app.frame-split .mock-nav span{font-size:0;height:26px;padding:0}.mock-app.frame-split .mock-nav span.on{background:var(--p)}
.site-sec{padding:60px 0}.site-sec.alt{border-top:1px solid var(--ln)}.site-sec h1{font-size:clamp(32px,5vw,52px);margin:14px 0 26px}
.scr-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.scr{display:flex;gap:12px;align-items:center;padding:16px;border-radius:var(--r);background:var(--sf);border:var(--bd)}
.site-auth{min-height:70vh;display:grid;place-items:center;padding:40px 0}
.ws-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}.ws-head h1{font-size:26px}
.chip-s{font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px;background:var(--sf2);color:var(--mut);white-space:nowrap}
.pos{color:#16a34a}.neg{color:#e11d48}.up{text-transform:uppercase;letter-spacing:.08em}
.pbar{width:90px;height:7px;border-radius:99px;background:var(--sf2);overflow:hidden;flex-shrink:0}.pbar i{display:block;height:100%;background:linear-gradient(90deg,var(--p),var(--a))}
.kvs1{display:grid;gap:10px}
textarea{padding:10px 12px;border:var(--bd);border-radius:calc(var(--r)*.7);background:var(--sf);width:100%;font:inherit;color:inherit;resize:vertical}
.app-top{display:flex;align-items:center;gap:14px;padding:10px 20px;border-bottom:1px solid var(--ln);background:var(--sf);position:sticky;top:0;z-index:5}
.tabs-h{display:flex;gap:2px;margin-left:18px}
.tabs-h a,.tabs-u a,.tabs-c a,.tabs-s a,.store-sub a{display:flex;gap:7px;align-items:center;padding:8px 12px;border-radius:10px;color:var(--mut);font-weight:600;cursor:pointer;white-space:nowrap}
.tabs-h a.on{background:var(--sf2);color:var(--ink)}
.board-wrap{display:grid;grid-template-columns:230px 1fr auto;min-height:calc(100vh - 57px)}
.lists{padding:18px 12px;border-right:1px solid var(--ln);display:grid;gap:2px;align-content:start;background:var(--sf)}.lists .up{margin:12px 8px 4px}
.lists a{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;cursor:pointer;color:var(--ink);font-weight:550}.lists a em{margin-left:auto;font-style:normal;color:var(--mut);font-size:12px}.lists a.on{background:color-mix(in srgb,var(--p) 12%,transparent);color:var(--p)}
.dotc{width:9px;height:9px;border-radius:3px;background:hsl(var(--h) 70% 55%)}
.board-wrap main{padding:24px 28px;max-width:none}
.quick{margin-bottom:12px}.quick input{width:100%;padding:13px 16px;border-radius:12px;border:1.5px dashed var(--ln);background:var(--sf)}
.ws-rows{display:grid;gap:4px}
.ws-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;background:var(--sf);border:1px solid transparent;transition:border-color .2s}
.ws-row:hover,.ws-row.on{border-color:color-mix(in srgb,var(--p) 40%,transparent)}.ws-row.done .ws-t{text-decoration:line-through;color:var(--mut)}
.ws-t{all:unset;flex:1;cursor:pointer;font-weight:600}
.drawer{width:340px;border-left:1px solid var(--ln);background:var(--sf);padding:20px;display:grid;gap:14px;align-content:start;animation:enter .3s both}.drawer h2{font-size:20px}
.tl-group h3{font-size:15px;margin:18px 0 8px}.tl-item{all:unset;box-sizing:border-box;display:grid;grid-template-columns:80px 1fr auto auto;gap:12px;align-items:center;width:100%;padding:11px 14px;margin-bottom:4px;border-radius:12px;background:var(--sf);cursor:pointer;border-left:4px solid var(--p)}
.tl-date{font-weight:700;font-size:13px;color:var(--p)}
.ledger-h{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 32px;background:var(--ink);color:var(--bg);flex-wrap:wrap}
.ledger-h select{width:auto;background:transparent;color:inherit;border-color:rgba(255,255,255,.3)}.ledger-h select option{color:#0f172a}.ledger-h .b{background:transparent;color:inherit;border-color:rgba(255,255,255,.3)}
.tabs-u{display:flex;gap:4px}.tabs-u a{color:color-mix(in srgb,var(--bg) 70%,transparent)}.tabs-u a.on{color:var(--bg);box-shadow:inset 0 -2px 0 var(--a);border-radius:0}.tabs-u a svg,.tabs-c a svg{display:none}
.ledger-main{max-width:1100px;margin:0 auto;padding:28px 32px}
.fi-hero{display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:end;padding:26px 0 30px;border-bottom:1px solid var(--ln);margin-bottom:20px}
.fi-big{font-size:clamp(40px,6vw,64px);font-weight:800;letter-spacing:-.04em}
.fi-pair{display:flex;gap:34px;justify-content:flex-end;flex-wrap:wrap}.fi-pair div{display:grid}.fi-pair b{font-size:22px}
.cat-bars{display:grid;gap:12px;margin-top:14px}.cat-b{display:grid;grid-template-columns:minmax(80px,140px) 1fr auto;gap:12px;align-items:center;padding:6px 0}
.ledger-add{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;align-items:center;margin-bottom:18px}
.month{margin-bottom:18px}.month-h{display:flex;justify-content:space-between;padding:8px 4px;border-bottom:2px solid var(--ink);margin-bottom:4px}
.tx-row{all:unset;box-sizing:border-box;display:grid;grid-template-columns:80px 1fr auto 110px;gap:12px;align-items:center;width:100%;padding:10px 4px;border-bottom:1px solid var(--ln);cursor:pointer}.tx-row b:last-child{text-align:right}.tx-row:hover{background:var(--sf2)}
.modal-inline{position:fixed;right:0;top:0;bottom:0;z-index:30;box-shadow:-20px 0 50px -20px rgba(0,0,0,.3)}.modal-inline .drawer{height:100%;overflow:auto}
.course-h{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 32px;border-bottom:1px solid var(--ln);background:var(--sf)}.course-h>.row:last-child{justify-content:flex-end}
.tabs-c{display:flex;gap:4px;background:var(--sf2);padding:4px;border-radius:99px}.tabs-c a{border-radius:99px}.tabs-c a.on{background:var(--sf);color:var(--ink);box-shadow:0 2px 8px -3px rgba(0,0,0,.2)}
.course-main{max-width:1150px;margin:0 auto;padding:28px 32px}.course-hero{padding:16px 0 24px}.course-hero h1{font-size:34px}
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.course-card{border-radius:var(--r);overflow:hidden;background:var(--sf);border:var(--bd)}
.course-cover{height:120px;background:linear-gradient(135deg,hsl(var(--h) 75% 60%),hsl(calc(var(--h) + 40) 80% 55%));display:grid;place-items:center}.course-cover span{color:#fff;font-weight:800;font-size:22px}
.course-body{padding:16px;display:grid;gap:8px}
.ring-s{--v:0;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--p) calc(var(--v)*1%),var(--sf2) 0);flex-shrink:0}.ring-s span{width:calc(100% - 12px);height:calc(100% - 12px);border-radius:50%;background:var(--sf);display:grid;place-items:center;font-weight:800;font-size:13px}
.player-wrap{display:grid;grid-template-columns:280px 1fr;gap:24px}
.syllabus{display:grid;gap:4px;align-content:start;padding:14px;border-radius:var(--r);background:var(--sf);border:var(--bd);position:sticky;top:20px}.syllabus .up{margin:10px 6px 2px}
.syl{all:unset;display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:8px;border-radius:9px;cursor:pointer;font-size:14px}.syl.on{background:color-mix(in srgb,var(--p) 12%,transparent);font-weight:700}
.syl-c{width:20px;height:20px;border-radius:50%;border:2px solid var(--ln);display:grid;place-items:center;font-size:11px}.syl-c.ok{background:#16a34a;border-color:#16a34a;color:#fff}
.lesson-a{display:grid;gap:16px;align-content:start}.lesson-a h1{font-size:30px}
.lesson-video{height:260px;border-radius:var(--r);background:linear-gradient(135deg,#0f172a,color-mix(in srgb,var(--p) 50%,#0f172a));display:grid;place-items:center}
.cards-wrap{display:grid;justify-items:center;gap:16px;text-align:center}
.flash{all:unset;cursor:pointer;width:min(520px,100%);height:300px;perspective:1000px;position:relative}
.flash .face{position:absolute;inset:0;border-radius:20px;display:grid;place-content:center;gap:8px;padding:30px;backface-visibility:hidden;transition:transform .6s cubic-bezier(.2,.7,.2,1);background:var(--sf);border:var(--bd);box-shadow:0 30px 60px -40px rgba(0,0,0,.5);font-size:22px}
.flash .back{transform:rotateY(180deg);background:var(--p);color:#fff;font-size:18px}.flash.flip .front{transform:rotateY(-180deg)}.flash.flip .back{transform:rotateY(0)}
.prog-hero{display:flex;gap:24px;align-items:center}
.rail-n{width:72px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px 0;background:var(--ink);position:sticky;top:0;height:100vh}
.rail-links{display:grid;gap:6px}.rail-links a{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;color:color-mix(in srgb,var(--bg) 60%,transparent);cursor:pointer;position:relative}.rail-links a span{display:none}.rail-links a.on{background:var(--p);color:#fff}
.rail-links a:hover::after{content:attr(data-t);position:absolute;left:54px;background:var(--ink);color:var(--bg);padding:4px 9px;border-radius:7px;font-size:12px;white-space:nowrap;z-index:9}
.split-wrap{flex:1;min-width:0;display:flex;flex-direction:column}
.split-h{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;border-bottom:1px solid var(--ln);background:var(--sf)}
main.split-main{padding:0;max-width:none;flex:1}.split-main>div>:not(.crm){padding:0}.split-main .ph,.split-main .kanban,.split-main .stack,.split-main .chips,.split-main .empty{margin:24px}
.crm{display:grid;grid-template-columns:340px 1fr;min-height:calc(100vh - 54px)}
.crm-list{border-right:1px solid var(--ln);padding:14px;min-width:0;display:grid;gap:4px;align-content:start;background:var(--sf)}
.crm-item{all:unset;box-sizing:border-box;width:100%;min-width:0;display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;cursor:pointer}.crm-item .grow{display:grid;min-width:0}.crm-item .grow>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crm-item .bdg{flex-shrink:0}.crm-item:hover{background:var(--sf2)}.crm-item.on{background:color-mix(in srgb,var(--p) 12%,transparent)}
.crm-sheet{padding:24px 30px;display:grid;gap:18px;align-content:start}
.crm-sheet-h{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.crm-sheet-h h1{font-size:26px}
.crm-cols{display:grid;grid-template-columns:1fr 1.2fr;gap:24px}
.studio-h{display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--ln);background:var(--sf)}
.tabs-s{display:flex;gap:2px;margin-left:16px}.tabs-s a.on{color:var(--ink);background:var(--sf2)}
main.studio-main{max-width:none;padding:0}
.studio-lib,.studio3{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 55px)}.studio3{grid-template-columns:220px 1fr 280px}
.studio-lib>div{padding:24px 28px}
.lib-side{border-right:1px solid var(--ln);padding:16px 10px;display:grid;gap:2px;align-content:start;background:var(--sf2)}
.lib-side a{display:flex;justify-content:space-between;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:14px}.lib-side a.on{background:var(--sf);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08)}.lib-side a em{font-style:normal;color:var(--mut);font-size:12px}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.doc{all:unset;cursor:pointer;display:grid;gap:8px}
.doc-page{height:220px;padding:16px;border-radius:6px;background:#fff;color:#0f172a;box-shadow:0 1px 2px rgba(0,0,0,.08),0 14px 30px -20px rgba(0,0,0,.4);display:grid;gap:8px;align-content:start;overflow:hidden;font-size:12.5px;transition:transform .25s}
.doc:hover .doc-page{transform:translateY(-4px) rotate(-.5deg)}.doc-page span{color:#64748b;line-height:1.5}
.editor{padding:40px min(8vw,90px);display:grid;grid-template-rows:auto 1fr auto;gap:14px;background:var(--sf)}
.ed-title{font-size:30px;font-weight:800;border:0;padding:0;background:none}.ed-title:focus{box-shadow:none}
.ed-body{border:0;padding:0;font-size:17px;line-height:1.75;min-height:420px;background:none;resize:none}.ed-body:focus{box-shadow:none;outline:0}
.props{border-left:1px solid var(--ln);padding:18px;display:grid;gap:14px;align-content:start;background:var(--sf2)}
.store-h{display:flex;justify-content:space-between;align-items:center;padding:12px 28px;background:var(--sf);border-bottom:1px solid var(--ln)}
.store-sub{display:flex;gap:4px;padding:0 24px;background:var(--sf);border-bottom:1px solid var(--ln)}.store-sub a{border-radius:0;padding:12px 14px}.store-sub a.on{color:var(--p);box-shadow:inset 0 -3px 0 var(--p)}
main.store-main{max-width:1200px;margin:0 auto;padding:24px 28px}
.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.prod{padding:12px;border-radius:var(--r);background:var(--sf);border:var(--bd);display:grid;gap:8px}
.prod-img{height:150px;border-radius:calc(var(--r)*.8);background:linear-gradient(135deg,hsl(var(--h) 80% 75%),hsl(calc(var(--h) + 40) 75% 62%));display:grid;place-items:center}.prod-img span{font-size:44px;font-weight:800;color:#fff}
.price-s{font-size:20px;font-weight:800}
.me-c{border:0;background:none;padding:0;cursor:pointer;border-radius:50%}
@media(max-width:860px){
.site-h{padding:12px 16px;flex-wrap:wrap;gap:10px}.site-h nav{order:3;width:100%;overflow-x:auto}
.site-main{padding:0 16px 40px}.site-f{padding:24px 16px}
.h-split,.h-asym,.h-ed-cols{grid-template-columns:1fr}.h-asym-side,.h-asym-mock{grid-column:1;grid-row:auto}.h-asym-mock{transform:none}
.h-bento{grid-template-columns:1fr 1fr}.hb-main,.hb-tile.t-app{grid-column:span 2}
.h-asym-feats{grid-template-columns:1fr}.h-asym-feats .hf{transform:none!important}
.h-ed-list .hf{grid-template-columns:50px 1fr}.h-ed-list .hf p{grid-column:2}
.mock-body{grid-template-columns:1fr!important}.mock-nav{display:none!important}
.app-top{flex-wrap:wrap;padding:10px 12px}.tabs-h{order:3;width:100%;margin:0;overflow-x:auto}
.board-wrap{grid-template-columns:1fr}.lists{display:flex;overflow-x:auto;border-right:0;border-bottom:1px solid var(--ln);padding:8px}.lists .up{display:none}.lists a{white-space:nowrap}
.board-wrap main{padding:16px}.drawer{position:fixed;inset:auto 0 0 0;width:auto;max-height:80vh;overflow:auto;border-left:0;border-top:1px solid var(--ln);z-index:30;box-shadow:0 -20px 50px -20px rgba(0,0,0,.4)}
.ledger-h,.course-h{padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px}.tabs-u,.tabs-c{order:3;width:100%;overflow-x:auto}
main.ledger-main,main.course-main,main.store-main{padding:16px}.fi-hero{grid-template-columns:1fr;gap:14px}.fi-pair{justify-content:flex-start}
.tx-row{grid-template-columns:64px 1fr auto}.tx-row .chip-s{display:none}
.player-wrap{grid-template-columns:1fr}.syllabus{position:static}
body.mode-app.frame-split{flex-direction:column}.rail-n{width:auto;height:auto;flex-direction:row;padding:8px;position:sticky;top:0;z-index:6}.rail-n>div{margin:0!important}.rail-links{display:flex}
.crm{grid-template-columns:1fr}.crm-list{border-right:0;border-bottom:1px solid var(--ln);max-height:260px;overflow:auto}.crm-cols{grid-template-columns:1fr}.crm-sheet{padding:16px}
.studio-h{flex-wrap:wrap}.tabs-s{order:3;width:100%;margin:0;overflow-x:auto}
.studio-lib,.studio3{grid-template-columns:1fr}.lib-side{display:flex;overflow-x:auto;border-right:0}.props{border-left:0}.editor{padding:20px 16px}
.store-h{padding:12px 16px}.store-sub{overflow-x:auto;padding:0 8px}
}`;
