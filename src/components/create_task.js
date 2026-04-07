import axios from 'axios';
import Swal from 'sweetalert2';

export default {
    name: 'CreateTask',
    data() {
        return {
            loading: false,
            loadingTasks: false,
            tasks: [],
            editingTaskId: null,
            editFormData: {
                title: '',
                description: '',
                completed: false
            },
            form: {
                title: '',
                description: '',
                completed: false
            }
        };
    },
    mounted() {
        this.fetchTasks();
    },
    methods: {
        async createTask() {
            this.loading = true;
            this.successMessage = '';
            this.errorMessage = '';

            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_BACKEND_API_URL}/task_management/create_task/`,
                    this.form,
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: response.data.message || 'Task created successfully.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    if (response.data.data) {
                        this.tasks.unshift(response.data.data);
                    }

                    this.resetForm();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.data.message || 'Failed to create task.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            } catch (error) {
                console.error('Create task error:', error);

                let errorMsg = 'Something went wrong.';
                if (error.response && error.response.data) {
                    const backendMessage = error.response.data.message;
                    errorMsg = typeof backendMessage === 'object' ? this.flattenErrors(backendMessage) : (backendMessage || errorMsg);
                } else {
                    errorMsg = 'Unable to connect to the server.';
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorMsg,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } finally {
                this.loading = false;
            }
        },

        async fetchTasks() {
            this.loadingTasks = true;

            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_BACKEND_API_URL}/task_management/get_tasks/`
                );

                if (response.data.status === 'success') {
                    this.tasks = response.data.data || [];
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.data.message || 'Failed to fetch tasks.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            } catch (error) {
                console.error('Fetch tasks error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Unable to load tasks.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } finally {
                this.loadingTasks = false;
            }
        },

        startEditTask(task) {
            this.editingTaskId = task.id;
            this.editFormData = {
                title: task.title,
                description: task.description,
                completed: task.completed
            };
        },

        cancelEditTask() {
            this.editingTaskId = null;
            this.editFormData = {
                title: '',
                description: '',
                completed: false
            };
        },

        async updateTask() {
            if (!this.editFormData.title.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Error',
                    text: 'Task title cannot be empty.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
                return;
            }

            this.loading = true;

            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_BACKEND_API_URL}/task_management/update_task/`,
                    {
                        task_id: this.editingTaskId,
                        title: this.editFormData.title,
                        description: this.editFormData.description,
                        completed: this.editFormData.completed
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: response.data.message || 'Task updated successfully.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    // Update the task in the local list
                    const taskIndex = this.tasks.findIndex(t => t.id === this.editingTaskId);
                    if (taskIndex !== -1) {
                        this.tasks[taskIndex] = response.data.data;
                    }

                    this.cancelEditTask();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.data.message || 'Failed to update task.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            } catch (error) {
                console.error('Update task error:', error);

                let errorMsg = 'Something went wrong.';
                if (error.response && error.response.data) {
                    const backendMessage = error.response.data.message;
                    errorMsg = typeof backendMessage === 'object' ? this.flattenErrors(backendMessage) : (backendMessage || errorMsg);
                } else {
                    errorMsg = 'Unable to connect to the server.';
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorMsg,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } finally {
                this.loading = false;
            }
        },

        async deleteTask(taskId) {
            const result = await Swal.fire({
                title: 'Delete Task?',
                text: 'Are you sure you want to delete this task? This action cannot be undone.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff6b6b',
                cancelButtonColor: '#999',
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel',
                reverseButtons: true
            });

            if (!result.isConfirmed) {
                return;
            }

            this.loading = true;

            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_BACKEND_API_URL}/task_management/delete_task/`,
                    {
                        task_id: taskId
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: response.data.message || 'Task deleted successfully.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    // Remove the task from the local list
                    this.tasks = this.tasks.filter(t => t.id !== taskId);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.data.message || 'Failed to delete task.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
            } catch (error) {
                console.error('Delete task error:', error);

                let errorMsg = 'Something went wrong.';
                if (error.response && error.response.data) {
                    const backendMessage = error.response.data.message;
                    errorMsg = typeof backendMessage === 'object' ? this.flattenErrors(backendMessage) : (backendMessage || errorMsg);
                } else {
                    errorMsg = 'Unable to connect to the server.';
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errorMsg,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } finally {
                this.loading = false;
            }
        },

        resetForm() {
            this.form = {
                title: '',
                description: '',
                completed: false
            };
        },

        flattenErrors(errorsObject) {
            return Object.values(errorsObject)
                .flat()
                .join(' ');
        },

        formatDate(dateString) {
            if (!dateString) {
                return '';
            }

            return new Date(dateString).toLocaleString();
        }
    }
};