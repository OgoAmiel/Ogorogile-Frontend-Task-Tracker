import axios from 'axios'

export default {
  name: 'ManagePendingRequests',
  emits: ['logout'],

  data() {
    return {
      user: null,
      requests: [],
      leaveTypes: [],
      loading: true,
      filterType: 'all',
      errorMessage: '',
      successMessage: '',
      processingRequestId: null,
      processingAction: '',
      currentTab: 'pending',
      showPreviewModal: false,
      previewUrl: '',
      previewType: '',
    }
  },

  computed: {
    displayName() {
      if (!this.user) return 'Manager'
      const fullName = `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim()
      return fullName || this.user.username || 'Manager'
    },

    displayRole() {
      if (!this.user?.role) return 'Manager'
      return this.capitalize(this.user.role.toLowerCase())
    },

    initials() {
      if (!this.user) return 'M'
      const first = this.user.first_name?.[0] || ''
      const last = this.user.last_name?.[0] || ''
      const fallback = this.user.username?.[0] || 'M'
      return `${first}${last}`.trim().toUpperCase() || fallback.toUpperCase()
    },

    requestTypeOptions() {
      return this.leaveTypes
        .filter((type) => type.is_active)
        .map((type) => ({
          id: type.id,
          name: type.name,
        }))
    },

    filteredRequests() {
      return this.requests
        .filter((request) => {
          const requestTypeId = request.leave_type?.id
          return (
            this.filterType === 'all' ||
            String(requestTypeId) === String(this.filterType)
          )
        })
        .map((request) => ({
          ...request,
          typeKey: this.mapLeaveTypeNameToKey(request.leave_type?.name || ''),
        }))
    },

    uniqueEmployeeCount() {
      return new Set(this.requests.map((request) => request.employee?.id)).size
    },

    totalRequestDays() {
      return this.requests.reduce((sum, request) => sum + Number(request.days_requested || 0), 0)
    },

    pageTitle() {
      if (this.currentTab === 'approved') return 'Approved Leave Requests'
      if (this.currentTab === 'rejected') return 'Rejected Leave Requests'
      return 'Pending Leave Requests'
    },

    pageSubtitle() {
      if (this.currentTab === 'approved') {
        return 'Review previously approved employee leave requests'
      }

      if (this.currentTab === 'rejected') {
        return 'Review previously rejected employee leave requests'
      }

      return 'Review and action employee leave requests'
    },

    currentTabTitle() {
      if (this.currentTab === 'approved') return 'Approved Requests Queue'
      if (this.currentTab === 'rejected') return 'Rejected Requests Queue'
      return 'Pending Requests Queue'
    },

    currentTabLabel() {
      if (this.currentTab === 'approved') return 'Approved Requests'
      if (this.currentTab === 'rejected') return 'Rejected Requests'
      return 'Pending Requests'
    },

    currentTabSubLabel() {
      if (this.currentTab === 'approved') return 'Already approved'
      if (this.currentTab === 'rejected') return 'Already rejected'
      return 'Awaiting your decision'
    },
  },

  async mounted() {
    await Promise.all([
      this.fetchCurrentUser(),
      this.fetchLeaveTypes(),
      this.fetchManagedRequests(),
    ])
  },

  methods: {
    getAuthHeaders() {
      const token = localStorage.getItem('accessToken')

      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    },

    getEndpointForCurrentTab() {
      if (this.currentTab === 'approved') {
        return 'get_approved_leave_requests/'
      }

      if (this.currentTab === 'rejected') {
        return 'get_rejected_leave_requests/'
      }

      return 'get_pending_leave_requests/'
    },

    normalizeAttachmentUrl(url) {
      if (!url) {
        return ''
      }

      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }

      const backendBaseUrl = import.meta.env.VITE_BACKEND_API_URL || ''
      const backendOrigin = backendBaseUrl.replace(/\/api\/?$/, '')

      if (url.startsWith('/')) {
        return `${backendOrigin}${url}`
      }

      return `${backendOrigin}/${url}`
    },

    async fetchCurrentUser() {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/auth/me/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        this.user = response.data.data
      } catch (error) {
        console.error('Fetch current user error:', error)
        this.errorMessage = 'Unable to load current user details.'
      }
    },

    async fetchLeaveTypes() {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_leave_types/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.leaveTypes = response.data.data || []
        }
      } catch (error) {
        console.error('Fetch leave types error:', error)
      }
    },

    async fetchManagedRequests() {
      this.loading = true
      this.errorMessage = ''

      try {
        const endpoint = this.getEndpointForCurrentTab()

        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/${endpoint}`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.requests = response.data.data || []
        } else {
          this.errorMessage = response.data.message || 'Failed to load leave requests.'
        }
      } catch (error) {
        console.error('Fetch managed leave requests error:', error)

        if (error.response && error.response.data) {
          this.errorMessage = error.response.data.message || 'Unable to load leave requests.'
        } else {
          this.errorMessage = 'Unable to connect to the server.'
        }
      } finally {
        this.loading = false
      }
    },

    async switchTab(tab) {
      this.currentTab = tab
      this.filterType = 'all'
      this.successMessage = ''
      this.errorMessage = ''

      if (!this.leaveTypes.length) {
        await this.fetchLeaveTypes()
      }

      await this.fetchManagedRequests()
    },

    async approveRequest(leaveRequestId) {
      this.processingRequestId = leaveRequestId
      this.processingAction = 'approve'
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/approve_leave_request/`,
          {
            leave_request_id: leaveRequestId,
          },
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'Leave request approved successfully.'
          await this.fetchManagedRequests()
        } else {
          this.errorMessage = response.data.message || 'Failed to approve leave request.'
        }
      } catch (error) {
        console.error('Approve leave request error:', error)

        if (error.response && error.response.data) {
          this.errorMessage = error.response.data.message || 'Unable to approve leave request.'
        } else {
          this.errorMessage = 'Unable to connect to the server.'
        }
      } finally {
        this.processingRequestId = null
        this.processingAction = ''
      }
    },

    async rejectRequest(leaveRequestId) {
      const rejectionReason = window.prompt('Please provide a rejection reason:')

      if (!rejectionReason || !rejectionReason.trim()) {
        return
      }

      this.processingRequestId = leaveRequestId
      this.processingAction = 'reject'
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/reject_leave_request/`,
          {
            leave_request_id: leaveRequestId,
            rejection_reason: rejectionReason.trim(),
          },
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'Leave request rejected successfully.'
          await this.fetchManagedRequests()
        } else {
          this.errorMessage = response.data.message || 'Failed to reject leave request.'
        }
      } catch (error) {
        console.error('Reject leave request error:', error)

        if (error.response && error.response.data) {
          this.errorMessage = error.response.data.message || 'Unable to reject leave request.'
        } else {
          this.errorMessage = 'Unable to connect to the server.'
        }
      } finally {
        this.processingRequestId = null
        this.processingAction = ''
      }
    },

    previewAttachment(url) {
      if (!url) {
        return
      }

      const normalizedUrl = this.normalizeAttachmentUrl(url)
      const cleanUrl = normalizedUrl.split('?')[0].toLowerCase()

      if (cleanUrl.endsWith('.pdf')) {
        window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
        return
      }

      if (
        cleanUrl.endsWith('.jpg') ||
        cleanUrl.endsWith('.jpeg') ||
        cleanUrl.endsWith('.png')
      ) {
        this.previewType = 'image'
        this.previewUrl = normalizedUrl
        this.showPreviewModal = true
        return
      }

      window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    },

    closePreview() {
      this.showPreviewModal = false
      this.previewUrl = ''
      this.previewType = ''
    },

    logoutUser() {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      this.$emit('logout')
    },

    formatEmployeeName(employee) {
      if (!employee) return 'Unknown Employee'
      const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
      return fullName || employee.username || 'Unknown Employee'
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
      const value = Number(days)
      return value === 1 ? '1 day requested' : `${value} days requested`
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

    capitalize(value) {
      if (!value) return ''
      return value.charAt(0).toUpperCase() + value.slice(1)
    },
  },
}