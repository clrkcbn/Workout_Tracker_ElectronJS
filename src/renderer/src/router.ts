import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  // Hash history works with bundled files and needs no server rewrites.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'today', component: () => import('./views/TodayView.vue') },
    { path: '/workout', name: 'workout', component: () => import('./views/WorkoutView.vue') },
    { path: '/exercises', name: 'exercises', component: () => import('./views/ExercisesView.vue') },
    { path: '/routines', name: 'routines', component: () => import('./views/RoutinesView.vue') },
    { path: '/routines/new', name: 'routine-new', component: () => import('./views/RoutineEditorView.vue') },
    { path: '/routines/:id', name: 'routine-edit', component: () => import('./views/RoutineEditorView.vue'), props: true },
    { path: '/schedule', name: 'schedule', component: () => import('./views/ScheduleView.vue') },
    { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue') },
    { path: '/history/:id', name: 'session', component: () => import('./views/SessionDetailView.vue'), props: true },
    { path: '/progress', name: 'progress', component: () => import('./views/ProgressView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
