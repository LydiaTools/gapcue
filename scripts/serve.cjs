const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const files = new Map([['/', ['index.html','text/html']],['/index.html',['index.html','text/html']],['/styles.css',['styles.css','text/css']],['/core.js',['core.js','text/javascript']],['/sample.js',['sample.js','text/javascript']],['/app.js',['app.js','text/javascript']]]);
files.set('/live.js', ['live.js','text/javascript']);
files.set('/live-i18n.js', ['live-i18n.js','text/javascript']);
function createServer() {
  return http.createServer(async(req,res)=>{
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = files.get(url.pathname);
    if(req.method!=='GET'||!file){res.writeHead(404);res.end('Not found');return;}
    try {const data = await fs.readFile(path.join(__dirname,'../app',file[0]));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
    catch{res.writeHead(500);res.end('Could not read app file');}
  });
}
module.exports={createServer};
if(require.main===module){const server=createServer();server.listen(8858,'127.0.0.1',()=>console.log('GapCue: http://127.0.0.1:8858'));}
