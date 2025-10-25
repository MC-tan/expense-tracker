// Service Worker สำหรับ Progressive Web App
// ทำให้แอพทำงานได้แม้ไม่มีอินเทอร์เน็ต

const CACHE_NAME = 'expense-tracker-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// ติดตั้ง Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('เปิด cache แล้ว');
        return cache.addAll(urlsToCache);
      })
  );
});

// เปิดใช้งาน Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('ลบ cache เก่า:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ดักจับการร้องขอ
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถ้ามีใน cache ให้ใช้จาก cache
        if (response) {
          return response;
        }
        
        // ถ้าไม่มีใน cache ให้ดาวน์โหลดจากเน็ต
        return fetch(event.request).then(
          response => {
            // ตรวจสอบว่าได้ response ที่ถูกต้อง
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // คัดลอก response เพื่อเก็บใน cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          }
        );
      })
  );
});

// รับข้อความจากแอพหลัก
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
