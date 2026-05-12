import axios from 'axios'

export default {
  name: 'AdminManagement',
  emits: ['logout'],

  data() {
    return {
      currentTab: 'users',
      user: null,

      users: [],
      leaveTypes: [],
      leaveRequests: [],
      leaveBalances: [],

      loading: true,
      submitting: false,
      leaveTypeSubmitting: false,
      balanceSubmitting: false,
      deleteSubmitting: false,
      deletingUserId: null,
      leaveTypeDeleteSubmitting: false,
      deletingLeaveTypeId: null,

      errorMessage: '',
      successMessage: '',

      searchTerm: '',
      roleFilter: 'all',

      requestSearchTerm: '',
      requestStatusFilter: 'all',
      requestTypeFilter: 'all',

      balanceSearchTerm: '',
      balanceTypeFilter: 'all',

      formMode: 'create',
      leaveTypeFormMode: 'create',

      isUserModalOpen: false,
      isLeaveTypeModalOpen: false,
      isBalanceModalOpen: false,

      userForm: {
        user_id: null,
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        employee_number: '',
        department: '',
        manager_id: '',
      },

      leaveTypeForm: {
        leave_type_id: null,
        name: '',
        default_days: '',
        requires_attachment: false,
        is_active: true,
      },

      leaveTypeErrors: {
        name: '',
        default_days: '',
      },

      balanceForm: {
        leave_balance_id: null,
        total_days: '',
      },
    }
  },

  computed: {
    displayName() {
      if (!this.user) return 'Admin'
      const fullName = `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim()
      return fullName || this.user.username || 'Admin'
    },

    displayRole() {
      if (!this.user?.role) return 'Admin'
      return this.capitalize(this.user.role.toLowerCase())
    },

    initials() {
      if (!this.user) return 'A'
      const first = this.user.first_name?.[0] || ''
      const last = this.user.last_name?.[0] || ''
      const fallback = this.user.username?.[0] || 'A'
      return `${first}${last}`.trim().toUpperCase() || fallback.toUpperCase()
    },

    pageTitle() {
      if (this.currentTab === 'leave_types') {
        return 'Admin Leave Types'
      }

      if (this.currentTab === 'leave_requests') {
        return 'Company Leave Requests'
      }

      if (this.currentTab === 'leave_balances') {
        return 'Company Leave Balances'
      }

      return 'Admin User Management'
    },

    pageSubtitle() {
      if (this.currentTab === 'leave_types') {
        return 'Create and manage leave types'
      }

      if (this.currentTab === 'leave_requests') {
        return 'View all leave requests across the company'
      }

      if (this.currentTab === 'leave_balances') {
        return 'View and adjust employee leave balances'
      }

      return 'Create, update, and manage system users'
    },

    totalUsers() {
      return this.users.length
    },

    totalEmployees() {
      return this.users.filter((userItem) => userItem.role === 'EMPLOYEE').length
    },

    totalManagers() {
      return this.users.filter((userItem) => userItem.role === 'MANAGER').length
    },

    totalLeaveTypes() {
      return this.leaveTypes.length
    },

    activeLeaveTypes() {
      return this.leaveTypes.filter((leaveType) => leaveType.is_active).length
    },

    attachmentRequiredLeaveTypes() {
      return this.leaveTypes.filter((leaveType) => leaveType.requires_attachment).length
    },

    totalCompanyRequests() {
      return this.leaveRequests.length
    },

    totalPendingRequests() {
      return this.leaveRequests.filter((request) => (request.status || '').toLowerCase() === 'pending').length
    },

    totalApprovedRequests() {
      return this.leaveRequests.filter((request) => (request.status || '').toLowerCase() === 'approved').length
    },

    totalRejectedRequests() {
      return this.leaveRequests.filter((request) => (request.status || '').toLowerCase() === 'rejected').length
    },

    totalBalanceRecords() {
      return this.leaveBalances.length
    },

    totalAllocatedDays() {
      return this.leaveBalances.reduce((sum, balance) => sum + Number(balance.total_days || 0), 0)
    },

    totalUsedDays() {
      return this.leaveBalances.reduce((sum, balance) => sum + Number(balance.used_days || 0), 0)
    },

    totalRemainingDays() {
      return this.leaveBalances.reduce((sum, balance) => sum + Number(balance.remaining_days || 0), 0)
    },

    filteredUsers() {
      return this.users.filter((userItem) => {
        const fullName = `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim().toLowerCase()
        const searchValue = this.searchTerm.trim().toLowerCase()

        const matchesSearch =
          !searchValue ||
          userItem.username.toLowerCase().includes(searchValue) ||
          fullName.includes(searchValue) ||
          (userItem.employee_number || '').toLowerCase().includes(searchValue) ||
          (userItem.department || '').toLowerCase().includes(searchValue) ||
          (userItem.email || '').toLowerCase().includes(searchValue)

        const matchesRole =
          this.roleFilter === 'all' || userItem.role === this.roleFilter

        return matchesSearch && matchesRole
      })
    },

    managerOptions() {
      return this.users.filter((userItem) => {
        if (userItem.role !== 'MANAGER' || !userItem.is_active) {
          return false
        }

        if (this.formMode === 'edit' && this.userForm.user_id === userItem.id) {
          return false
        }

        return true
      })
    },

    requestTypeOptions() {
      return this.leaveTypes
        .filter((type) => type.is_active)
        .map((type) => ({
          id: type.id,
          name: type.name,
        }))
    },

    filteredLeaveRequests() {
      return this.leaveRequests.filter((request) => {
        const employeeName = this.formatEmployeeName(request.employee).toLowerCase()
        const leaveTypeName = (request.leave_type?.name || '').toLowerCase()
        const reason = (request.reason || '').toLowerCase()
        const department = (request.employee?.department || '').toLowerCase()
        const searchValue = this.requestSearchTerm.trim().toLowerCase()
        const status = (request.status || '').toLowerCase()
        const typeKey = this.mapLeaveTypeNameToKey(request.leave_type?.name || '')

        const matchesSearch =
          !searchValue ||
          employeeName.includes(searchValue) ||
          leaveTypeName.includes(searchValue) ||
          reason.includes(searchValue) ||
          department.includes(searchValue) ||
          (request.employee?.username || '').toLowerCase().includes(searchValue)

        const matchesStatus =
          this.requestStatusFilter === 'all' || status === this.requestStatusFilter

        const matchesType =
          this.requestTypeFilter === 'all' || request.leave_type?.id === this.requestTypeFilter

        return matchesSearch && matchesStatus && matchesType
      })
    },

    balanceTypeOptions() {
      return this.leaveTypes
        .filter((type) => type.is_active)
        .map((type) => ({
          id: type.id,
          name: type.name,
        }))
    },

    filteredLeaveBalances() {
      return this.leaveBalances.filter((balance) => {
        const employeeName = this.formatEmployeeName(balance.employee).toLowerCase()
        const leaveTypeName = (balance.leave_type_name || '').toLowerCase()
        const department = (balance.employee?.department || '').toLowerCase()
        const username = (balance.employee?.username || '').toLowerCase()
        const searchValue = this.balanceSearchTerm.trim().toLowerCase()

        const matchesSearch =
          !searchValue ||
          employeeName.includes(searchValue) ||
          leaveTypeName.includes(searchValue) ||
          department.includes(searchValue) ||
          username.includes(searchValue) ||
          (balance.employee?.employee_number || '').toLowerCase().includes(searchValue)

        const matchesType =
          this.balanceTypeFilter === 'all' ||
          balance.leave_type_name === this.balanceTypeFilter

        return matchesSearch && matchesType
      })
    },
  },

  async mounted() {
    await this.loadAdminPage()
  },

  methods: {
    getAuthHeaders() {
      const token = localStorage.getItem('accessToken')

      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    },

    async loadAdminPage() {
      this.loading = true
      this.errorMessage = ''
      this.successMessage = ''

      try {
        await Promise.all([
          this.fetchCurrentUser(),
          this.fetchUsers(),
          this.fetchLeaveTypes(),
        ])
      } catch (error) {
        console.error('Admin page load error:', error)
        this.errorMessage = 'Unable to load admin page.'
      } finally {
        this.loading = false
      }
    },

    async switchTab(tab) {
      this.currentTab = tab
      this.errorMessage = ''
      this.successMessage = ''

      if (tab === 'leave_types') {
        await this.fetchLeaveTypes()
      } else if (tab === 'leave_requests') {
        if (!this.leaveTypes.length) {
          await this.fetchLeaveTypes()
        }
        await this.fetchAllLeaveRequests()
      } else if (tab === 'leave_balances') {
        if (!this.leaveTypes.length) {
          await this.fetchLeaveTypes()
        }
        await this.fetchLeaveBalances()
      } else {
        await this.fetchUsers()
      }
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

    async fetchUsers() {
      this.loading = true
      this.errorMessage = ''

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/user_management/get_users/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.users = response.data.data || []
        } else {
          this.errorMessage = response.data.message || 'Failed to load users.'
        }
      } catch (error) {
        console.error('Fetch users error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else {
          this.errorMessage = 'Unable to load users.'
        }
      } finally {
        this.loading = false
      }
    },

    async fetchLeaveTypes() {
      this.loading = true
      this.errorMessage = ''

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_leave_types/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.leaveTypes = response.data.data || []
        } else {
          this.errorMessage = response.data.message || 'Failed to load leave types.'
        }
      } catch (error) {
        console.error('Fetch leave types error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else {
          this.errorMessage = 'Unable to load leave types.'
        }
      } finally {
        this.loading = false
      }
    },

    async fetchAllLeaveRequests() {
      this.loading = true
      this.errorMessage = ''

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_all_leave_requests/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.leaveRequests = response.data.data || []
        } else {
          this.errorMessage = response.data.message || 'Failed to load leave requests.'
        }
      } catch (error) {
        console.error('Fetch all leave requests error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else {
          this.errorMessage = 'Unable to load leave requests.'
        }
      } finally {
        this.loading = false
      }
    },

    async fetchLeaveBalances() {
      this.loading = true
      this.errorMessage = ''

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/get_all_leave_balances/`,
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.leaveBalances = response.data.data || []
        } else {
          this.errorMessage = response.data.message || 'Failed to load leave balances.'
        }
      } catch (error) {
        console.error('Fetch leave balances error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else {
          this.errorMessage = 'Unable to load leave balances.'
        }
      } finally {
        this.loading = false
      }
    },

    openCreateUserForm() {
      this.formMode = 'create'
      this.errorMessage = ''
      this.successMessage = ''
      this.resetForm()
      this.isUserModalOpen = true
    },

    openEditUserForm(userItem) {
      this.formMode = 'edit'
      this.errorMessage = ''
      this.successMessage = ''
      this.isUserModalOpen = true

      this.userForm = {
        user_id: userItem.id,
        username: userItem.username || '',
        first_name: userItem.first_name || '',
        last_name: userItem.last_name || '',
        email: userItem.email || '',
        password: '',
        role: userItem.role || 'EMPLOYEE',
        employee_number: userItem.employee_number || '',
        department: userItem.department || '',
        manager_id: userItem.manager_id || '',
      }
    },

    resetForm() {
      this.userForm = {
        user_id: null,
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        employee_number: '',
        department: '',
        manager_id: '',
      }
    },

    handleRoleChange() {
      if (this.userForm.role !== 'EMPLOYEE') {
        this.userForm.manager_id = ''
      }
    },

    validateForm() {
      if (!this.userForm.first_name.trim()) {
        return 'First name is required.'
      }

      if (!this.userForm.last_name.trim()) {
        return 'Last name is required.'
      }

      if (!this.userForm.email.trim()) {
        return 'Email is required.'
      }

      if (this.formMode === 'create' && !this.userForm.username.trim()) {
        return 'Username is required.'
      }

      if (this.formMode === 'create' && !this.userForm.password) {
        return 'Password is required.'
      }

      if (this.userForm.role === 'EMPLOYEE' && !this.userForm.manager_id) {
        return 'Employees must be assigned to a manager.'
      }

      return ''
    },

    buildCreatePayload() {
      return {
        username: this.userForm.username.trim(),
        first_name: this.userForm.first_name.trim(),
        last_name: this.userForm.last_name.trim(),
        email: this.userForm.email.trim(),
        password: this.userForm.password,
        role: this.userForm.role,
        employee_number: this.userForm.employee_number ? this.userForm.employee_number.trim() : null,
        department: this.userForm.department.trim(),
        manager_id: this.userForm.role === 'EMPLOYEE' && this.userForm.manager_id
          ? Number(this.userForm.manager_id)
          : null,
      }
    },

    buildUpdatePayload() {
      return {
        user_id: this.userForm.user_id,
        first_name: this.userForm.first_name.trim(),
        last_name: this.userForm.last_name.trim(),
        email: this.userForm.email.trim(),
        role: this.userForm.role,
        employee_number: this.userForm.employee_number ? this.userForm.employee_number.trim() : null,
        department: this.userForm.department.trim(),
        manager_id: this.userForm.role === 'EMPLOYEE' && this.userForm.manager_id
          ? Number(this.userForm.manager_id)
          : null,
      }
    },

    async createUser() {
      const payload = this.buildCreatePayload()

      return axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/user_management/create_user/`,
        payload,
        {
          headers: this.getAuthHeaders(),
        }
      )
    },

    async updateUser() {
      const payload = this.buildUpdatePayload()

      return axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/user_management/update_user/`,
        payload,
        {
          headers: this.getAuthHeaders(),
        }
      )
    },

    async submitUserForm() {
      if (this.submitting) {
        return
      }

      const validationMessage = this.validateForm()

      if (validationMessage) {
        this.errorMessage = validationMessage
        this.successMessage = ''
        return
      }

      this.submitting = true
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = this.formMode === 'create'
          ? await this.createUser()
          : await this.updateUser()

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'User saved successfully.'
          await this.fetchUsers()

          if (this.formMode === 'create') {
            this.resetForm()
          }

          this.closeUserModal()
        } else {
          this.errorMessage = response.data.message || 'Failed to save user.'
        }
      } catch (error) {
        console.error('Submit user form error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else if (typeof message === 'object' && message !== null) {
          this.errorMessage = Object.values(message).flat().join(' ')
        } else {
          this.errorMessage = 'Unable to save user.'
        }
      } finally {
        this.submitting = false
      }
    },

    closeUserModal() {
      this.isUserModalOpen = false
      this.errorMessage = ''
    },

    async deleteUser(userItem) {
      if (this.deleteSubmitting) {
        return
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete ${this.formatUserName(userItem)}? This action cannot be undone.`
      )

      if (!confirmed) {
        return
      }

      this.deleteSubmitting = true
      this.deletingUserId = userItem.id
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/user_management/delete_user/`,
          { user_id: userItem.id },
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'User deleted successfully.'
          await this.fetchUsers()
        } else {
          this.errorMessage = response.data.message || 'Failed to delete user.'
        }
      } catch (error) {
        console.error('Delete user error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else if (typeof message === 'object' && message !== null) {
          this.errorMessage = Object.values(message).flat().join(' ')
        } else {
          this.errorMessage = 'Unable to delete user.'
        }
      } finally {
        this.deleteSubmitting = false
        this.deletingUserId = null
      }
    },

    openCreateLeaveTypeForm() {
      this.leaveTypeFormMode = 'create'
      this.errorMessage = ''
      this.successMessage = ''
      this.resetLeaveTypeForm()
      this.resetLeaveTypeErrors()
      this.isLeaveTypeModalOpen = true
    },

    openEditLeaveTypeForm(leaveType) {
      this.leaveTypeFormMode = 'edit'
      this.errorMessage = ''
      this.successMessage = ''
      this.resetLeaveTypeErrors()
      this.isLeaveTypeModalOpen = true

      this.leaveTypeForm = {
        leave_type_id: leaveType.id,
        name: leaveType.name || '',
        default_days: leaveType.default_days || '',
        requires_attachment: !!leaveType.requires_attachment,
        is_active: !!leaveType.is_active,
      }
    },

    resetLeaveTypeForm() {
      this.leaveTypeForm = {
        leave_type_id: null,
        name: '',
        default_days: '',
        requires_attachment: false,
        is_active: true,
      }
      this.resetLeaveTypeErrors()
    },

    validateLeaveTypeForm() {
      this.resetLeaveTypeErrors()

      let isValid = true
      const name = this.leaveTypeForm.name.trim()
      const defaultDays = this.leaveTypeForm.default_days

      if (!name) {
        this.leaveTypeErrors.name = 'Leave type name is required.'
        isValid = false
      }

      if (defaultDays === '' || defaultDays === null) {
        this.leaveTypeErrors.default_days = 'Default days is required.'
        isValid = false
      } else if (Number(defaultDays) < 0) {
        this.leaveTypeErrors.default_days = 'Default days cannot be negative.'
        isValid = false
      }

      const duplicateLeaveType = this.leaveTypes.find((leaveType) => {
        const existingName = (leaveType.name || '').trim().toLowerCase()
        const submittedName = name.toLowerCase()

        if (this.leaveTypeFormMode === 'edit' && leaveType.id === this.leaveTypeForm.leave_type_id) {
          return false
        }
        return existingName === submittedName
      })

      if (duplicateLeaveType) {
        this.leaveTypeErrors.name = 'A leave type with this name already exists.'
        isValid = false
      }
      return isValid
    },

    resetLeaveTypeErrors() {
      this.leaveTypeErrors = {
        name: '',
        default_days: '',
      }
    },

    clearLeaveTypeError(fieldName) {
      this.leaveTypeErrors[fieldName] = ''
      this.errorMessage = ''
    },

    buildCreateLeaveTypePayload() {
      return {
        name: this.leaveTypeForm.name.trim(),
        default_days: this.leaveTypeForm.default_days,
        requires_attachment: this.leaveTypeForm.requires_attachment,
        is_active: this.leaveTypeForm.is_active,
      }
    },

    buildUpdateLeaveTypePayload() {
      return {
        leave_type_id: this.leaveTypeForm.leave_type_id,
        name: this.leaveTypeForm.name.trim(),
        default_days: this.leaveTypeForm.default_days,
        requires_attachment: this.leaveTypeForm.requires_attachment,
        is_active: this.leaveTypeForm.is_active,
      }
    },

    async createLeaveType() {
      const payload = this.buildCreateLeaveTypePayload()

      return axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/create_leave_type/`,
        payload,
        {
          headers: this.getAuthHeaders(),
        }
      )
    },

    async updateLeaveType() {
      const payload = this.buildUpdateLeaveTypePayload()

      return axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/update_leave_type/`,
        payload,
        {
          headers: this.getAuthHeaders(),
        }
      )
    },

    async submitLeaveTypeForm() {
      if (this.leaveTypeSubmitting) {
        return
      }

      const isValid = this.validateLeaveTypeForm()

      if (!isValid) {
        this.successMessage = ''
        return
      }

      this.leaveTypeSubmitting = true
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = this.leaveTypeFormMode === 'create'
          ? await this.createLeaveType()
          : await this.updateLeaveType()

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'Leave type saved successfully.'
          await this.fetchLeaveTypes()

          if (this.leaveTypeFormMode === 'create') {
            this.resetLeaveTypeForm()
          }

          this.closeLeaveTypeModal()
        } else {
          this.errorMessage = response.data.message || 'Failed to save leave type.'
        }
      } catch (error) {
        console.error('Submit leave type form error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          if (message.toLowerCase().includes('leave type with this name already exists')) {
            this.leaveTypeErrors.name = message
          } else if (message.toLowerCase().includes('default days')) {
            this.leaveTypeErrors.default_days = message
          } else {
            this.errorMessage = message
          }
        } else if (typeof message === 'object' && message !== null) {
          this.leaveTypeErrors.name = Array.isArray(message.name)
            ? message.name.join(' ')
            : message.name || ''

          this.leaveTypeErrors.default_days = Array.isArray(message.default_days)
            ? message.default_days.join(' ')
            : message.default_days || ''

            if (!this.leaveTypeErrors.name && !this.leaveTypeErrors.default_days) {
              this.errorMessage = Object.values(message).flat().join(' ')
            }
          } else if (Array.isArray(message)) {
            this.errorMessage = message.join(' ')
          } else {
            this.errorMessage = 'Unable to save leave type.'
          }
      } finally {
        this.leaveTypeSubmitting = false
      }
    },

    closeLeaveTypeModal() {
      this.isLeaveTypeModalOpen = false
      this.errorMessage = ''
    },

    async deleteLeaveType(leaveType) {
      if (this.leaveTypeDeleteSubmitting) {
        return
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${leaveType.name}"? This action cannot be undone.`
      )

      if (!confirmed) {
        return
      }

      this.leaveTypeDeleteSubmitting = true
      this.deletingLeaveTypeId = leaveType.id
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/delete_leave_type/`,
          { leave_type_id: leaveType.id },
          {
            headers: this.getAuthHeaders(),
          }
        )

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'Leave type deleted successfully.'
          await this.fetchLeaveTypes()
        } else {
          this.errorMessage = response.data.message || 'Failed to delete leave type.'
        }
      } catch (error) {
        console.error('Delete leave type error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else if (typeof message === 'object' && message !== null) {
          this.errorMessage = Object.values(message).flat().join(' ')
        } else {
          this.errorMessage = 'Unable to delete leave type.'
        }
      } finally {
        this.leaveTypeDeleteSubmitting = false
        this.deletingLeaveTypeId = null
      }
    },

    openEditBalanceModal(balance) {
      this.errorMessage = ''
      this.successMessage = ''
      this.isBalanceModalOpen = true

      this.balanceForm = {
        leave_balance_id: balance.id,
        total_days: balance.total_days,
      }
    },

    closeBalanceModal() {
      this.isBalanceModalOpen = false
      this.errorMessage = ''
    },

    resetBalanceForm() {
      this.balanceForm = {
        leave_balance_id: null,
        total_days: '',
      }
    },

    validateBalanceForm() {
      if (this.balanceForm.total_days === '' || this.balanceForm.total_days === null) {
        return 'Total days is required.'
      }

      return ''
    },

    buildUpdateBalancePayload() {
      return {
        leave_balance_id: this.balanceForm.leave_balance_id,
        total_days: this.balanceForm.total_days,
      }
    },

    async updateLeaveBalance() {
      const payload = this.buildUpdateBalancePayload()

      return axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/leave_management/update_leave_balance/`,
        payload,
        {
          headers: this.getAuthHeaders(),
        }
      )
    },

    async submitBalanceForm() {
      if (this.balanceSubmitting) {
        return
      }

      const validationMessage = this.validateBalanceForm()

      if (validationMessage) {
        this.errorMessage = validationMessage
        this.successMessage = ''
        return
      }

      this.balanceSubmitting = true
      this.errorMessage = ''
      this.successMessage = ''

      try {
        const response = await this.updateLeaveBalance()

        if (response.data.status === 'success') {
          this.successMessage = response.data.message || 'Leave balance updated successfully.'
          await this.fetchLeaveBalances()
          this.closeBalanceModal()
        } else {
          this.errorMessage = response.data.message || 'Failed to update leave balance.'
        }
      } catch (error) {
        console.error('Update leave balance error:', error)

        const message = error?.response?.data?.message

        if (typeof message === 'string') {
          this.errorMessage = message
        } else if (Array.isArray(message)) {
          this.errorMessage = message.join(' ')
        } else if (typeof message === 'object' && message !== null) {
          this.errorMessage = Object.values(message).flat().join(' ')
        } else {
          this.errorMessage = 'Unable to update leave balance.'
        }
      } finally {
        this.balanceSubmitting = false
      }
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
      return value === 1 ? '1 day' : `${value} days`
    },

    mapLeaveTypeNameToKey(name) {
      const value = (name || '').toLowerCase()

      if (value.includes('annual')) return 'annual'
      if (value.includes('sick')) return 'sick'
      if (value.includes('family')) return 'personal'
      if (value.includes('personal')) return 'personal'
      return 'other'
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

    getRequestStatusBadgeClass(status) {
      const value = (status || '').toLowerCase()

      if (value === 'approved') {
        return 'approved'
      }

      if (value === 'rejected') {
        return 'rejected'
      }

      return 'pending'
    },

    logoutUser() {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      this.$emit('logout')
    },

    formatUserName(userItem) {
      if (!userItem) return 'Unknown User'
      const fullName = `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim()
      return fullName || userItem.username || 'Unknown User'
    },

    formatRole(role) {
      return this.capitalize((role || '').toLowerCase())
    },

    capitalize(value) {
      if (!value) return ''
      return value.charAt(0).toUpperCase() + value.slice(1)
    },
  },
}