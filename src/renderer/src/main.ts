import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { db } from './lib/db'
import './assets/main.css'

// Ask Chromium to treat the journal as persistent storage (never evicted).
void navigator.storage?.persist?.().catch(() => undefined)

db.open()
  .catch((error) => console.error('Could not open the database', error))
  .finally(() => {
    createApp(App).use(router).mount('#app')
  })
