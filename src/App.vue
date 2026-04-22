<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import LoginPage from './components/LoginPage.vue'
import LeaveManagement from './components/LeaveManagement.vue'
import ManagePendingRequests from './components/ManagePendingRequests.vue'

const isAuthenticated = ref(!!localStorage.getItem('accessToken'))
const currentUser = ref(null)
const loadingUser = ref(false)

async function loadCurrentUser() {
  const token = localStorage.getItem('accessToken')

  if (!token) {
    currentUser.value = null
    return
  }

  loadingUser.value = true

  try {
    const response = await axios.get(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/me/`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    currentUser.value = response.data.data
  } catch (error) {
    console.error('Load current user error:', error)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    currentUser.value = null
    isAuthenticated.value = false
  } finally {
    loadingUser.value = false
  }
}

async function handleLoginSuccess() {
  isAuthenticated.value = true
  await loadCurrentUser()
}

function handleLogout() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  currentUser.value = null
  isAuthenticated.value = false
}

onMounted(async () => {
  if (isAuthenticated.value) {
    await loadCurrentUser()
  }
})
</script>

<template>
  <LoginPage
    v-if="!isAuthenticated"
    @login-success="handleLoginSuccess"
  />

  <div v-else-if="loadingUser" class="container py-5 text-center">
    Loading...
  </div>

  <ManagePendingRequests
    v-else-if="currentUser && currentUser.role === 'MANAGER'"
    @logout="handleLogout"
  />

  <LeaveManagement
    v-else-if="currentUser"
    @logout="handleLogout"
  />
</template>