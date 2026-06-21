var CACHE_NAME='mijn-dossiers-v2';
var CACHE_ASSETS=['icon-192.png','icon-512.png'];

self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(function(c){return c.addAll(CACHE_ASSETS);}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE_NAME;}).map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch',function(e){
  var req=e.request;
  // Alleen GET; laat POST/PUT (o.a. Firebase) met rust
  if(req.method!=='GET')return;
  var url;
  try{url=new URL(req.url);}catch(err){return;}
  // Alleen eigen origin onderscheppen; externe bronnen (Firebase, gstatic) ongemoeid
  if(url.origin!==self.location.origin)return;

  var accept=req.headers.get('accept')||'';
  var isHTML=req.mode==='navigate'||accept.indexOf('text/html')!==-1||/\.html?$/.test(url.pathname);

  if(isHTML){
    // NETWORK-FIRST: altijd de verse pagina ophalen, cache enkel als offline-terugval
    e.respondWith(
      fetch(req).then(function(resp){
        if(resp&&resp.status===200){var copy=resp.clone();caches.open(CACHE_NAME).then(function(c){c.put(req,copy);});}
        return resp;
      }).catch(function(){
        return caches.match(req).then(function(r){return r||caches.match('agenda.html');});
      })
    );
    return;
  }

  // STATISCHE ASSETS (iconen e.d.): cache-first met stille achtergrond-update
  e.respondWith(
    caches.match(req).then(function(cached){
      var net=fetch(req).then(function(resp){
        if(resp&&resp.status===200){var copy=resp.clone();caches.open(CACHE_NAME).then(function(c){c.put(req,copy);});}
        return resp;
      }).catch(function(){return cached;});
      return cached||net;
    })
  );
});

self.addEventListener('message',function(e){
  if(!e.data||e.data.type!=='SHOW_NOTIFICATIONS')return;
  e.data.appointments.forEach(function(a){
    self.registration.showNotification('📅 '+a.titel,{
      body:(a.tijdstip?a.tijdstip+' ':'')+(a.locatie?'— '+a.locatie:''),
      icon:'icon-192.png',
      badge:'icon-192.png',
      data:{url:self.registration.scope+'agenda.html'}
    });
  });
});

self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var target=self.registration.scope+'agenda.html';
  e.waitUntil(
    clients.matchAll({type:'window'}).then(function(cs){
      for(var i=0;i<cs.length;i++){
        if(cs[i].url.indexOf('agenda.html')!==-1)return cs[i].focus();
      }
      return clients.openWindow(target);
    })
  );
});
