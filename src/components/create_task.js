import axios from 'axios';

export default {
    name: 'CreateTask',
    data() {
        return {
            loading: false,
            successMessage: '',
            errorMessage: '',
            tasks: [],
            form: {
                title: '',
                description: '',
                completed: false
            }
        };
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
                    this.successMessage = response.data.message || 'Task created successfully.';

                    if (response.data.data) {
                        this.tasks.unshift(response.data.data);
                    }

                    this.resetForm();
                } else {
                    this.errorMessage = response.data.message || 'Failed to create task.';
                }
            } catch (error) {
                console.error('Create task error:', error);

                if (error.response && error.response.data) {
                    const backendMessage = error.response.data.message;

                    if (typeof backendMessage === 'object') {
                        this.errorMessage = this.flattenErrors(backendMessage);
                    } else {
                        this.errorMessage = backendMessage || 'Something went wrong.';
                    }
                } else {
                    this.errorMessage = 'Unable to connect to the server.';
                }
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