import axios from 'axios'

export default {
  name: 'LeaveManagement',
  emits: ['logout'],

  data() {
    return {
      tab: 'overview',
      loadingDashboard: true,
      submittingRequest: false,
      submitSuccess: false,
      formError: '',
      filterStatus: 'all',
      filterType: 'all',

      user: null,
      balances: [],
      requests: [],

      form: {
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachment: null,
      },

      computedDays: 0,
      durationError: '',
    }
  },

  computed: {
    displayName() {
      if (!this.user) return 'User'
      const fullName = `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim()
      return fullName || this.user.username || 'User'
    },

    displayRole() {
      if (!this.user?.role) return 'Employee'
      return this.capitalize(this.user.role.toLowerCase())
    },

    initials() {
      if (!this.user) return 'U'
      const first = this.user.first_name?.[0] || ''
      const last = this.user.last_name?.[0] || ''
      const fallback = this.user.username?.[0] || 'U'
      return `${first}${last}`.trim().toUpperCase() || fallback.toUpperCase()
    },

    pageTitle() {
      return {
        overview: 'Overview',
        request: 'Request Leave',
        history: 'My Requests',
      }[this.tab]
    },

    pageSubtitle() {
      const d = new Date()
      return `${this.displayName} · ${d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`
    },

    balanceCards() {
      return this.balances.map((balance) => {
        const typeKey = this.mapLeaveTypeNameToKey(balance.leave_type_name)

        return {
          key: typeKey,
          label: balance.leave_type_name,
          total: Number(balance.total_days),
          used: Number(balance.used_days),
          remaining: Number(balance.remaining_days),
          color: this.typeColor(typeKey),
        }
      })
    },

    leaveTypeOptions() {
      return this.balances.map((balance) => ({
        id: balance.leave_type,
        name: balance.leave_type_name,
        key: this.mapLeaveTypeNameToKey(balance.leave_type_name),
      }))
    },

    leaveTypeFilterOptions() {
      const map = new Map()

      this.leaveTypeOptions.forEach((type) => {
        map.set(type.key, { key: type.key, name: type.name })
      })

      return Array.from(map.values())
    },

    computedDurationLabel() {
      if (this.durationError) return ''
      if (!this.computedDays) return 'Select dates'
      return this.computedDays === 1
        ? '1 day'
        : `${this.computedDays} days`
    },

    canSubmit() {
      return this.form.leave_type_id && this.form.start_date && this.form.end_date && this.computedDays > 0 && !this.durationError
    },

    mappedRequests() {
      return this.requests.map((request) => ({
        id: request.id,
        type: request.leave_type?.name || 'Leave',
        typeKey: this.mapLeaveTypeNameToKey(request.leave_type?.name || 'Other'),
        start: request.start_date,
        end: request.end_date,
        days: Number(request.days_requested),
        status: (request.status || '').toLowerCase(),
        cancellation_reason: request.cancellation_reason || '',
        rejection_reason: request.rejection_reason || '',
        attachment_url: request.attachment_url || '',
      }))
    },

    upcomingLeave() {
      const today = new Date().toISOString().slice(0, 10)

      return this.mappedRequests.filter(
        (request) => request.status === 'approved' && request.start >= today
      )
    },

    filteredRequests() {
      return this.mappedRequests.filter((request) => {
        const matchStatus = this.filterStatus === 'all' || request.status === this.filterStatus
        const matchType = this.filterType === 'all' || request.typeKey === this.filterType
        return matchStatus && matchType
      })
    },
  },

  async mounted() {
    await this.loadDashboard()
  },

  methods: {
    getAuthHeaders() {
      const token = localStorage.getItem('accessToken')

      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    },

    async loadDashboard() {
      this.loadingDashboard = true

      try {
        await Promise.all([
          this.fetchCurrentUser(),
          this.fetchLeaveBalances(),
          this.fetchLeaveRequests(),
        ])

        if (!this.form.leave_type_id && this.leaveTypeOptions.length > 0) {
          this.form.leave_type_id = this.leaveTypeOptions[0].id
        }
      } catch (error) {
        console.error('Dashboard load error:', error)

        if (error.response?.status === 401) {
          this.logoutUser()
        }
      } finally {
        this.loadingDashboard = false
      }
    },

    async fetchCurrentUser() {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/auth/me/`,
        {
          headers: this.getAuthHeaders(),
        }
      )

      this.user = response.data.data
    },

    async fetchLeaveBalances() {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_leave_balances/`,
        {
          headers: this.getAuthHeaders(),
        }
      )

      this.balances = response.data.data || []
    },

    async fetchLeaveRequests() {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_leave_requests/`,
        {
          headers: this.getAuthHeaders(),
        }
      )

      this.requests = response.data.data || []
    },

    computeDuration() {
      this.durationError = ''
      this.computedDays = 0

      const { start_date, end_date } = this.form
      if (!start_date || !end_date) return

      const start = new Date(`${start_date}T00:00:00`)
      const end = new Date(`${end_date}T00:00:00`)

      if (end < start) {
        this.durationError = 'End date must be on or after start date'
        return
      }

      const millisecondsPerDay = 24 * 60 * 60 * 1000
      this.computedDays = Math.floor((end - start) / millisecondsPerDay) + 1
    },

    async submitRequest() {
      if (!this.canSubmit || this.submittingRequest) return

      this.submittingRequest = true
      this.formError = ''
      this.submitSuccess = false

      try {
        const formData = new FormData()
        formData.append('leave_type_id', Number(this.form.leave_type_id))
        formData.append('start_date', this.form.start_date)
        formData.append('end_date', this.form.end_date)
        formData.append('reason', this.form.reason || '')

        if (this.form.attachment) {
          formData.append('attachment', this.form.attachment)
        }

        const token = localStorage.getItem('accessToken')

        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/create_leave_request/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        this.requests = [response.data.data, ...this.requests]
        this.submitSuccess = true
        this.tab = 'history'

        this.form = {
          leave_type_id: this.leaveTypeOptions.length > 0 ? this.leaveTypeOptions[0].id : '',
          start_date: '',
          end_date: '',
          reason: '',
          attachment: null,
        }

        this.computedDays = 0
        this.durationError = ''

        await this.fetchLeaveBalances()
        await this.fetchLeaveRequests()

        setTimeout(() => {
          this.submitSuccess = false
        }, 4000)
      } catch (error) {
        console.error('Create leave request error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.formError = message
        } else if (typeof message === 'object' && message !== null) {
          this.formError = Object.values(message).flat().join(' ')
        } else {
          this.formError = 'Unable to submit leave request.'
        }
      } finally {
        this.submittingRequest = false
      }
    },

    handleAttachmentChange(event) {
      const files = event.target.files

      if (files && files.length > 0) {
        this.form.attachment = files[0]
      } else {
        this.form.attachment = null
      }
    },

    async cancelRequest(request) {
      let cancellationReason = ''

      if (request.status === 'approved') {
        cancellationReason = window.prompt('Please provide a cancellation reason for this approved leave request:') || ''

        if (!cancellationReason.trim()) {
          return
        }
      } else {
        cancellationReason = window.prompt('Add a cancellation reason (optional):') || ''
      }

      try {
        await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/cancel_leave_request/`,
          {
            leave_request_id: request.id,
            cancellation_reason: cancellationReason,
          },
          {
            headers: this.getAuthHeaders(),
          }
        )

        await this.fetchLeaveBalances()
        await this.fetchLeaveRequests()
      } catch (error) {
        console.error('Cancel leave request error:', error)
        const message = error?.response?.data?.message
        alert(typeof message === 'string' ? message : 'Unable to cancel leave request.')
      }
    },

    switchToRequestTab() {
      this.formError = ''
      this.submitSuccess = false
      this.tab = 'request'
    },

    logoutUser() {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      this.$emit('logout')
    },

    usedPercent(balance) {
      if (!balance.total) return 0
      return ((balance.used / balance.total) * 100).toFixed(0)
    },

    typeColor(key) {
      return {
        annual: '#2563eb',
        sick: '#16a34a',
        personal: '#9333ea',
        other: '#64748b',
      }[key] || '#64748b'
    },

    mapLeaveTypeNameToKey(name) {
      const value = (name || '').toLowerCase()

      if (value.includes('annual')) return 'annual'
      if (value.includes('sick')) return 'sick'
      if (value.includes('family')) return 'personal'
      if (value.includes('personal')) return 'personal'
      return 'other'
    },

    formatDateRange(start, end) {
      const format = (dateString) =>
        new Date(`${dateString}T00:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })

      return start === end ? format(start) : `${format(start)} – ${format(end)}`
    },

    formatDaysLabel(days) {
      return days === 1 ? '1 day' : `${days} days`
    },

    capitalize(value) {
      if (!value) return ''
      return value.charAt(0).toUpperCase() + value.slice(1)
    },
  },
}