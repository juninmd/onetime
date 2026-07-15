const STYLE = /* css */ `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; background: #0b0f17; color: #e5e7eb; padding: 20px; }
  .card { width: 100%; max-width: 560px; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px; }
  h1 { margin: 0 0 4px; font-size: 20px; } .sub { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  textarea, input, select { width: 100%; background: #0b0f17; border: 1px solid #374151; color: #e5e7eb; border-radius: 10px; padding: 12px; font: inherit; }
  textarea { min-height: 130px; resize: vertical; font-family: ui-monospace, monospace; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
  label { font-size: 12px; color: #9ca3af; display: block; margin-bottom: 6px; }
  button { width: 100%; margin-top: 8px; background: #2563eb; border: 0; color: #fff; padding: 13px; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #1d4ed8; } button:disabled { opacity: .5; cursor: default; }
  .link { margin-top: 18px; word-break: break-all; background: #0b0f17; border: 1px dashed #374151; border-radius: 10px; padding: 12px; font-family: ui-monospace, monospace; font-size: 13px; }
  .ok { color: #22c55e; } .err { color: #ef4444; } .warn { color: #f59e0b; }
  .reveal { white-space: pre-wrap; word-break: break-word; background: #0b0f17; border: 1px solid #374151; border-radius: 10px; padding: 14px; font-family: ui-monospace, monospace; }
  a { color: #60a5fa; }
`;

const B64 = /* js */ `
function bufToB64url(buf){var b=new Uint8Array(buf),s='';for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}
function b64urlToBuf(str){str=str.replace(/-/g,'+').replace(/_/g,'/');while(str.length%4)str+='=';var bin=atob(str),b=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return b;}
`;

export const createHtml = /* html */ `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>onetime · segredo de uso único</title><style>${STYLE}</style></head><body>
<div class="card">
  <h1>🔐 onetime</h1>
  <div class="sub">Criptografado no seu navegador. O servidor guarda só o texto cifrado — a chave vive no link (#) e nunca chega ao servidor.</div>
  <textarea id="secret" placeholder="Cole a senha, token ou nota que quer compartilhar…"></textarea>
  <div class="grid">
    <div><label>Expira em</label>
      <select id="ttl">
        <option value="600">10 minutos</option>
        <option value="3600" selected>1 hora</option>
        <option value="86400">1 dia</option>
        <option value="604800">7 dias</option>
      </select></div>
    <div><label>Leituras permitidas</label>
      <select id="views"><option>1</option><option>2</option><option>5</option></select></div>
  </div>
  <button id="go">Gerar link</button>
  <div id="out"></div>
</div>
<script>${B64}
var out=document.getElementById('out');
document.getElementById('go').onclick=async function(){
  var txt=document.getElementById('secret').value;
  if(!txt){out.innerHTML='<div class="err">Digite algo primeiro.</div>';return;}
  this.disabled=true;
  try{
    var key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    var iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(txt));
    var packed=new Uint8Array(iv.length+ct.byteLength);packed.set(iv,0);packed.set(new Uint8Array(ct),iv.length);
    var raw=await crypto.subtle.exportKey('raw',key);
    var res=await fetch('/api/secret',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({blob:bufToB64url(packed),ttlSec:+document.getElementById('ttl').value,views:+document.getElementById('views').value})});
    var data=await res.json();
    var link=location.origin+'/s/'+data.id+'#'+bufToB64url(raw);
    out.innerHTML='<div class="link ok">'+link+'</div><button id="cp">Copiar link</button>';
    document.getElementById('cp').onclick=function(){navigator.clipboard.writeText(link);this.textContent='Copiado ✓';};
  }catch(e){out.innerHTML='<div class="err">Falhou: '+e.message+'</div>';}
  this.disabled=false;
};
</script></body></html>`;

export const readerHtml = /* html */ `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>onetime · revelar</title><style>${STYLE}</style></head><body>
<div class="card">
  <h1>🔓 Segredo de uso único</h1>
  <div class="sub warn">Isto pode ser mostrado só uma vez. Copie antes de fechar.</div>
  <div id="body"><button id="reveal">Revelar segredo</button></div>
  <div class="sub" style="margin-top:18px"><a href="/">Criar um novo</a></div>
</div>
<script>${B64}
document.getElementById('reveal').onclick=async function(){
  var body=document.getElementById('body');
  var id=location.pathname.split('/').pop();
  var keyB64=location.hash.slice(1);
  if(!keyB64){body.innerHTML='<div class="err">Link incompleto (sem chave).</div>';return;}
  this.disabled=true;this.textContent='Revelando…';
  try{
    var res=await fetch('/api/secret/'+id);
    if(res.status!==200){body.innerHTML='<div class="err">Segredo indisponível — expirado ou já lido.</div>';return;}
    var data=await res.json();
    var packed=b64urlToBuf(data.blob);
    var iv=packed.slice(0,12),ct=packed.slice(12);
    var key=await crypto.subtle.importKey('raw',b64urlToBuf(keyB64),{name:'AES-GCM'},false,['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct);
    var txt=new TextDecoder().decode(pt);
    body.innerHTML='<div class="reveal" id="r"></div><button id="cp">Copiar</button>';
    document.getElementById('r').textContent=txt;
    document.getElementById('cp').onclick=function(){navigator.clipboard.writeText(txt);this.textContent='Copiado ✓';};
  }catch(e){body.innerHTML='<div class="err">Não deu para decifrar (chave errada ou dado corrompido).</div>';}
};
</script></body></html>`;
