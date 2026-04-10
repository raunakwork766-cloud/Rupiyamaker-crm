// Add debug function to safely get DOM elements with logging
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`DOM element with ID '${id}' not found`);
    }
    return element;
}

/**
 * Product Form Utilities
 * Handles all product form interactions, calculations, and API operations
 */

// Display alert message
function showAlert(type, message, duration = 3000) {
    try {
        const alertElement = type === 'error' ? document.getElementById('errorAlert') : document.getElementById('successAlert');
        const messageElement = type === 'error' ? document.getElementById('errorMessage') : document.getElementById('successMessage');

        if (alertElement && messageElement) {
            messageElement.textContent = message;
            alertElement.style.display = 'block';

            setTimeout(() => {
                alertElement.style.display = 'none';
            }, duration);
        } else {
            // Fallback to using auth.js showAlert if it exists
            if (typeof window.showAlert === 'function') {
                window.showAlert(message, type === 'error' ? 'danger' : 'success');
            } else {
                // Ultimate fallback
                console.log(`${type}: ${message}`);
                alert(message);
            }
        }
    } catch (e) {
        // If any error occurs, fallback to basic alert
        console.error('Error showing alert:', e);
        alert(`${type === 'error' ? 'Error' : 'Success'}: ${message}`);
    }
}

// API handler for products and forms
class ProductAPI {
    static async getProducts() {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get('/products', {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.items;
        } catch (error) {
            console.error('Error fetching products:', error);
            showAlert('error', 'Failed to load products');
            return [];
        }
    }

    static async createProduct(productData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.post('/products', productData, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating product:', error);
            showAlert('error', 'Failed to create product');
            throw error;
        }
    }

    static async getProductDetails(productId) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get(`/products/${productId}`, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching product details:', error);
            showAlert('error', 'Failed to load product details');
            return null;
        }
    }

    static async getLeads() {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get('/leads', {
                params: {
                    user_id: userId,
                    page: 1,
                    page_size: 100
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.items;
        } catch (error) {
            console.error('Error fetching leads:', error);
            showAlert('error', 'Failed to load leads');
            return [];
        }
    }

    static async getLeadDetails(leadId) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get(`/leads/${leadId}`, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching lead details:', error);
            showAlert('error', 'Failed to load lead details');
            return null;
        }
    }

    static async getFormTemplate(productId) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get(`/products/forms/templates/${productId}`, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching form template:', error);
            showAlert('error', 'Failed to load form template');
            return null;
        }
    }

    static async getLeadFormSubmissions(leadId) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get(`/products/lead/${leadId}/forms`, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching lead form submissions:', error);
            showAlert('error', 'Failed to load form submissions for this lead');
            return [];
        }
    }

    static async getFormSubmission(submissionId) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.get(`/products/forms/submissions/${submissionId}`, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching form submission:', error);
            showAlert('error', 'Failed to load form submission');
            return null;
        }
    }

    static async submitForm(formData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.post('/products/forms/submit', formData, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error submitting form:', error);
            showAlert('error', 'Failed to submit form');
            throw error;
        }
    }

    static async updateFormSubmission(submissionId, formData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.put(`/products/forms/submissions/${submissionId}`, formData, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error updating form submission:', error);
            showAlert('error', 'Failed to update form submission');
            throw error;
        }
    }

    static async createProductFormTemplate(productId, templateData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.post(`/products/${productId}/forms/template`, templateData, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating product form template:', error);
            showAlert('error', 'Failed to create form template');
            throw error;
        }
    }

    static async createFormSection(productId, sectionData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.post(`/products/forms/sections`, {
                product_id: productId,
                ...sectionData
            }, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating form section:', error);
            showAlert('error', 'Failed to create form section');
            throw error;
        }
    }

    static async createFormField(sectionId, fieldData) {
        try {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            const response = await axios.post(`/products/forms/fields`, {
                section_id: sectionId,
                ...fieldData
            }, {
                params: { user_id: userId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating form field:', error);
            showAlert('error', 'Failed to create form field');
            throw error;
        }
    }
}

// Financial calculation utilities with improved error handling
class FinancialCalculator {
    /**
     * Calculate EMI (Equated Monthly Installment)
     * @param {number} principal - Loan principal amount
     * @param {number} rate - Annual interest rate (in percentage)
     * @param {number} tenure - Loan tenure (in months)
     * @returns {number} Monthly EMI amount
     */
    static calculateEMI(principal, rate, tenure) {
        try {
            // Validate inputs
            principal = parseFloat(principal);
            rate = parseFloat(rate);
            tenure = parseInt(tenure);

            if (isNaN(principal) || principal <= 0) {
                console.warn('Invalid principal amount for EMI calculation');
                return 0;
            }

            if (isNaN(rate) || rate <= 0) {
                console.warn('Invalid interest rate for EMI calculation');
                return 0;
            }

            if (isNaN(tenure) || tenure <= 0) {
                console.warn('Invalid tenure for EMI calculation');
                return 0;
            }

            // Convert annual rate to monthly rate and percentage to decimal
            const monthlyRate = rate / (12 * 100);

            // Calculate EMI using the formula: P * r * (1+r)^n / ((1+r)^n - 1)
            const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) /
                (Math.pow(1 + monthlyRate, tenure) - 1);

            return isFinite(emi) ? Math.round(emi) : 0;
        } catch (error) {
            console.error('Error calculating EMI:', error);
            return 0;
        }
    }

    /**
     * Calculate loan eligibility based on income, obligations, and FOIR
     * @param {number} monthlyIncome - Total monthly income
     * @param {number} obligations - Current monthly obligations
     * @param {number} foirPercentage - Fixed Obligation to Income Ratio (in percentage)
     * @param {number} rate - Annual interest rate (in percentage)
     * @param {number} tenure - Loan tenure (in months)
     * @returns {number} Maximum eligible loan amount
     */
    static calculateLoanEligibility(monthlyIncome, obligations, foirPercentage, rate, tenure) {
        try {
            // Validate inputs
            monthlyIncome = parseFloat(monthlyIncome);
            obligations = parseFloat(obligations);
            foirPercentage = parseFloat(foirPercentage);
            rate = parseFloat(rate);
            tenure = parseInt(tenure);

            if (isNaN(monthlyIncome) || monthlyIncome <= 0) {
                console.warn('Invalid monthly income for loan eligibility calculation');
                return 0;
            }

            if (isNaN(obligations) || obligations < 0) {
                console.warn('Invalid obligations for loan eligibility calculation');
                obligations = 0;
            }

            if (isNaN(foirPercentage) || foirPercentage <= 0 || foirPercentage > 100) {
                console.warn('Invalid FOIR percentage for loan eligibility calculation');
                return 0;
            }

            if (isNaN(rate) || rate <= 0) {
                console.warn('Invalid interest rate for loan eligibility calculation');
                return 0;
            }

            if (isNaN(tenure) || tenure <= 0) {
                console.warn('Invalid tenure for loan eligibility calculation');
                return 0;
            }

            // Calculate disposable income based on FOIR
            const maxObligations = (monthlyIncome * foirPercentage) / 100;

            // Calculate available EMI capacity after existing obligations
            const availableEmi = maxObligations - obligations;

            if (availableEmi <= 0) {
                return 0;
            }

            // Convert annual rate to monthly rate and percentage to decimal
            const monthlyRate = rate / (12 * 100);

            // Calculate loan eligibility using EMI formula in reverse
            // P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)
            const eligibleLoan = availableEmi * (Math.pow(1 + monthlyRate, tenure) - 1) /
                (monthlyRate * Math.pow(1 + monthlyRate, tenure));

            return isFinite(eligibleLoan) ? Math.round(eligibleLoan) : 0;
        } catch (error) {
            console.error('Error calculating loan eligibility:', error);
            return 0;
        }
    }

    /**
     * Calculate loan eligibility based on income multiplier
     * @param {number} monthlyIncome - Monthly income
     * @param {number} multiplier - Income multiplier (typically 36-60 months)
     * @returns {number} Maximum eligible loan amount based on multiplier
     */
    static calculateMultiplierEligibility(monthlyIncome, multiplier) {
        try {
            // Validate inputs
            monthlyIncome = parseFloat(monthlyIncome);
            multiplier = parseFloat(multiplier);

            if (isNaN(monthlyIncome) || monthlyIncome <= 0) {
                console.warn('Invalid monthly income for multiplier calculation');
                return 0;
            }

            if (isNaN(multiplier) || multiplier <= 0) {
                console.warn('Invalid multiplier for loan eligibility calculation');
                return 0;
            }

            // Calculate loan eligibility based on annual income multiplier
            const annualIncome = monthlyIncome * 12;
            const eligibleLoan = annualIncome * multiplier;

            return Math.round(eligibleLoan);
        } catch (error) {
            console.error('Error calculating multiplier eligibility:', error);
            return 0;
        }
    }

    /**
     * Format currency value
     * @param {number} value - The value to format
     * @param {string} locale - Locale for formatting (default: en-IN for Indian format)
     * @param {string} currency - Currency code (default: INR)
     * @returns {string} Formatted currency string
     */
    static formatCurrency(value, locale = 'en-IN', currency = 'INR') {
        try {
            value = parseFloat(value);
            if (isNaN(value)) return '0';

            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        } catch (error) {
            console.error('Error formatting currency:', error);
            return value.toString();
        }
    }

    /**
     * Format percentage value
     * @param {number} value - The percentage value to format
     * @returns {string} Formatted percentage string
     */
    static formatPercentage(value) {
        try {
            value = parseFloat(value);
            if (isNaN(value)) return '0%';

            return value.toFixed(2) + '%';
        } catch (error) {
            console.error('Error formatting percentage:', error);
            return value + '%';
        }
    }
}

// Form field validator
class FormValidator {
    static validateRequiredFields(form) {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    static validateNumberField(field, min = null, max = null) {
        const value = parseFloat(field.value);

        if (isNaN(value)) {
            field.classList.add('is-invalid');
            return false;
        }

        if (min !== null && value < min) {
            field.classList.add('is-invalid');
            return false;
        }

        if (max !== null && value > max) {
            field.classList.add('is-invalid');
            return false;
        }

        field.classList.remove('is-invalid');
        return true;
    }
}

// Loan calculation utility
class LoanCalculator {
    static calculateEMI(principal, rate, tenure) {
        // Convert interest rate from percentage to decimal and then to monthly
        const monthlyRate = rate / 12 / 100;

        // Calculate EMI using the formula: P * r * (1+r)^n / ((1+r)^n - 1)
        if (monthlyRate === 0 || tenure === 0) return 0;

        const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) /
            (Math.pow(1 + monthlyRate, tenure) - 1);

        return isNaN(emi) ? 0 : emi;
    }

    static calculateLoanEligibility(monthlyIncome, obligations, foirPercentage, rate, tenure) {
        // Calculate disposable income based on FOIR
        const disposableIncome = monthlyIncome * (foirPercentage / 100);

        // Calculate available EMI capacity after existing obligations
        const availableEMI = disposableIncome - obligations;

        if (availableEMI <= 0) {
            return 0;
        }

        // Convert rate from percentage to decimal and then to monthly
        const monthlyRate = rate / 12 / 100;

        // Calculate loan eligibility using EMI formula in reverse
        // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
        // Therefore, P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)
        if (monthlyRate === 0 || tenure === 0) return 0;

        const factor = Math.pow(1 + monthlyRate, tenure);
        const eligibleLoan = availableEMI * (factor - 1) / (monthlyRate * factor);

        return isNaN(eligibleLoan) ? 0 : eligibleLoan;
    }

    static calculateMultiplierEligibility(monthlyIncome, multiplier) {
        // Calculate loan eligibility based on annual income multiplier
        return monthlyIncome * 12 * multiplier;
    }
}

// Product Form Builder
class ProductFormBuilder {
    constructor() {
        this.productData = null;
        this.sections = [];
        this.fields = [];
        this.currentProductId = null;

        // Initialize event listeners for product creation modal
        this.initProductCreationModal();
    }

    initProductCreationModal() {
        // Tab navigation buttons
        document.getElementById('nextToSectionsBtn').addEventListener('click', () => this.validateAndNavigate('basic-info', 'form-sections'));
        document.getElementById('backToBasicBtn').addEventListener('click', () => this.navigateTab('basic-info'));
        document.getElementById('nextToFieldsBtn').addEventListener('click', () => this.validateAndNavigate('form-sections', 'form-fields'));
        document.getElementById('backToSectionsBtn').addEventListener('click', () => this.navigateTab('form-sections'));

        // Section actions
        document.getElementById('addSectionBtn').addEventListener('click', () => this.addSection());

        // Field actions
        document.getElementById('fieldType').addEventListener('change', () => this.toggleOptionsContainer());
        document.getElementById('addOptionBtn').addEventListener('click', () => this.addOption());
        document.getElementById('addFieldBtn').addEventListener('click', () => this.addField());

        // Complete product creation
        document.getElementById('completeProductCreationBtn').addEventListener('click', () => this.createCompleteProduct());

        // Listen for option removal
        document.addEventListener('click', e => {
            if (e.target.classList.contains('remove-option') || e.target.closest('.remove-option')) {
                const button = e.target.classList.contains('remove-option') ? e.target : e.target.closest('.remove-option');
                button.closest('.input-group').remove();
            }
        });

        // Listen for section or field deletion
        document.addEventListener('click', e => {
            if (e.target.classList.contains('delete-section') || e.target.closest('.delete-section')) {
                const button = e.target.classList.contains('delete-section') ? e.target : e.target.closest('.delete-section');
                const sectionId = button.getAttribute('data-id');
                this.removeSection(sectionId);
            }

            if (e.target.classList.contains('delete-field') || e.target.closest('.delete-field')) {
                const button = e.target.classList.contains('delete-field') ? e.target : e.target.closest('.delete-field');
                const fieldId = button.getAttribute('data-id');
                this.removeField(fieldId);
            }
        });
    }

    validateAndNavigate(currentTab, nextTab) {
        if (currentTab === 'basic-info') {
            const form = document.getElementById('productBasicInfoForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Store basic product info
            this.productData = {
                name: document.getElementById('productName').value,
                category: 'loan-product', // Set default category for loan products
                status: document.getElementById('productStatus').value
            };
        } else if (currentTab === 'form-sections' && this.sections.length === 0) {
            showAlert('error', 'Please add at least one form section before proceeding');
            return;
        }

        // Navigate to the next tab
        this.navigateTab(nextTab);

        // If moving to fields tab, update section dropdown
        if (nextTab === 'form-fields') {
            this.updateSectionDropdown();
        }
    }

    navigateTab(tabId) {
        // Activate the specified tab
        const tabEl = document.getElementById(`${tabId}-tab`);
        const tab = new bootstrap.Tab(tabEl);
        tab.show();
    }

    addSection() {
        const form = document.getElementById('sectionForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const sectionName = document.getElementById('sectionName').value;
        const sectionData = {
            id: 'temp_' + Date.now(), // Temporary ID until saved to server
            name: sectionName,
            description: document.getElementById('sectionDescription').value,
            order: parseInt(document.getElementById('sectionOrder').value) || 1,
            is_required: document.getElementById('sectionRequired').checked,
            is_active: document.getElementById('sectionActive').checked
        };

        this.sections.push(sectionData);
        this.renderSections();

        // Automatically add obligation fields if the section name contains "obligation"
        if (sectionName.toLowerCase().includes('obligation')) {
            this.addObligationFields(sectionData.id);
        }

        // Reset form
        document.getElementById('sectionName').value = '';
        document.getElementById('sectionDescription').value = '';
        document.getElementById('sectionOrder').value = this.sections.length + 1;
    }

    // Helper method to add standard obligation fields to a section
    addObligationFields(sectionId) {
        // Define standard obligation fields
        const obligationFields = [
            {
                label: "Obligation Type",
                field_type: "select",
                placeholder: "Select obligation type",
                help_text: "Type of obligation or loan",
                order: 1,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false,
                options: [
                    { label: "Personal Loan", value: "personal-loan" },
                    { label: "Home Loan", value: "home-loan" },
                    { label: "Car Loan", value: "car-loan" },
                    { label: "Credit Card", value: "credit-card" },
                    { label: "Business Loan", value: "business-loan" },
                    { label: "Education Loan", value: "education-loan" },
                    { label: "Other", value: "other" }
                ]
            },
            {
                label: "Bank Name",
                field_type: "text",
                placeholder: "Enter bank name",
                help_text: "Name of the bank or financial institution",
                order: 2,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "Tenure",
                field_type: "number",
                placeholder: "Number of months",
                help_text: "Loan tenure in months",
                order: 3,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "Rate of Interest",
                field_type: "number",
                placeholder: "Interest rate (%)",
                help_text: "Annual interest rate in percentage",
                order: 4,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "Loan Amount",
                field_type: "number",
                placeholder: "Original loan amount",
                help_text: "Original loan amount in rupees",
                order: 5,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "Outstanding Amount",
                field_type: "number",
                placeholder: "Current outstanding amount",
                help_text: "Current outstanding amount in rupees",
                order: 6,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "EMI Amount",
                field_type: "number",
                placeholder: "Monthly EMI amount",
                help_text: "Current EMI amount in rupees",
                order: 7,
                is_required: true,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false
            },
            {
                label: "Balance Transfer",
                field_type: "select",
                placeholder: "Balance transfer option",
                help_text: "Whether this obligation is eligible for balance transfer",
                order: 8,
                is_required: false,
                is_active: true,
                is_visible: true,
                is_admin_only: false,
                is_readonly: false,
                options: [
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" }
                ]
            }
        ];

        // Add each obligation field to the section
        obligationFields.forEach(field => {
            const fieldData = {
                id: 'temp_field_' + Date.now() + '_' + Math.floor(Math.random() * 1000), // Unique temp ID
                section_id: sectionId,
                ...field
            };

            this.fields.push(fieldData);
        });

        // Update the fields display
        this.renderFields();
    }

    removeSection(sectionId) {
        // Check if there are fields using this section
        const fieldsInSection = this.fields.filter(field => field.section_id === sectionId);
        if (fieldsInSection.length > 0) {
            if (!confirm(`This section has ${fieldsInSection.length} fields. Deleting it will also delete these fields. Proceed?`)) {
                return;
            }

            // Remove all fields in this section
            this.fields = this.fields.filter(field => field.section_id !== sectionId);
            this.renderFields();
        }

        // Remove the section
        this.sections = this.sections.filter(section => section.id !== sectionId);
        this.renderSections();
        this.updateSectionDropdown();
    }

    renderSections() {
        const sectionsList = document.getElementById('sectionsList');
        sectionsList.innerHTML = '';

        this.sections.forEach(section => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${section.name}</td>
                <td>${section.order}</td>
                <td>${section.is_required ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                <td>${section.is_active ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger delete-section" data-id="${section.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            sectionsList.appendChild(row);
        });
    }

    updateSectionDropdown() {
        const sectionSelect = document.getElementById('fieldSection');
        sectionSelect.innerHTML = '<option value="">Select Section</option>';

        this.sections.forEach(section => {
            if (section.is_active) {
                const option = document.createElement('option');
                option.value = section.id;
                option.textContent = section.name;
                sectionSelect.appendChild(option);
            }
        });
    }

    toggleOptionsContainer() {
        const fieldType = document.getElementById('fieldType').value;
        const optionsContainer = document.getElementById('optionsContainer');

        if (fieldType === 'select' || fieldType === 'checkbox' || fieldType === 'radio') {
            optionsContainer.style.display = 'block';

            // Add a default option if none exist
            const optionsList = document.getElementById('optionsList');
            if (optionsList.children.length === 0) {
                this.addOption();
            }
        } else {
            optionsContainer.style.display = 'none';
        }
    }

    addOption() {
        const optionsList = document.getElementById('optionsList');
        const optionDiv = document.createElement('div');
        optionDiv.className = 'input-group mb-2';
        optionDiv.innerHTML = `
            <input type="text" class="form-control option-label" placeholder="Option Label">
            <input type="text" class="form-control option-value" placeholder="Option Value">
            <button type="button" class="btn btn-outline-danger remove-option">
                <i class="fas fa-times"></i>
            </button>
        `;
        optionsList.appendChild(optionDiv);
    }

    collectOptions() {
        const options = [];
        const optionRows = document.querySelectorAll('#optionsList .input-group');

        optionRows.forEach(row => {
            const labelInput = row.querySelector('.option-label');
            const valueInput = row.querySelector('.option-value');

            if (labelInput.value.trim()) {
                options.push({
                    label: labelInput.value,
                    value: valueInput.value.trim() || labelInput.value
                });
            }
        });

        return options;
    }

    addField() {
        const form = document.getElementById('fieldForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const fieldType = document.getElementById('fieldType').value;
        let options = null;

        if (fieldType === 'select' || fieldType === 'checkbox' || fieldType === 'radio') {
            options = this.collectOptions();
            if (options.length === 0) {
                showAlert('error', 'Please add at least one option for this field type');
                return;
            }
        }

        const fieldData = {
            id: 'temp_field_' + Date.now(), // Temporary ID until saved to server
            section_id: document.getElementById('fieldSection').value,
            label: document.getElementById('fieldLabel').value,
            field_type: fieldType,
            placeholder: document.getElementById('fieldPlaceholder').value,
            help_text: document.getElementById('fieldHelpText').value,
            order: parseInt(document.getElementById('fieldOrder').value) || 1,
            is_required: document.getElementById('fieldRequired').checked,
            is_active: document.getElementById('fieldActive').checked,
            is_visible: document.getElementById('fieldVisible').checked,
            is_admin_only: document.getElementById('fieldAdminOnly').checked,
            is_readonly: document.getElementById('fieldReadOnly').checked,
            options: options
        };

        this.fields.push(fieldData);
        this.renderFields();

        // Reset form
        document.getElementById('fieldLabel').value = '';
        document.getElementById('fieldPlaceholder').value = '';
        document.getElementById('fieldHelpText').value = '';
        document.getElementById('fieldOrder').value = 1;
        document.getElementById('fieldRequired').checked = false;
        document.getElementById('fieldAdminOnly').checked = false;
        document.getElementById('fieldReadOnly').checked = false;

        // Clear options if present
        if (options) {
            document.getElementById('optionsList').innerHTML = '';
            this.addOption();
        }
    }

    removeField(fieldId) {
        this.fields = this.fields.filter(field => field.id !== fieldId);
        this.renderFields();
    }

    renderFields() {
        const fieldsList = document.getElementById('fieldsList');
        fieldsList.innerHTML = '';

        this.fields.forEach(field => {
            // Find the section name
            const section = this.sections.find(s => s.id === field.section_id);
            const sectionName = section ? section.name : 'Unknown Section';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sectionName}</td>
                <td>${field.label}</td>
                <td><span class="badge bg-info">${field.field_type}</span></td>
                <td>${field.is_required ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger delete-field" data-id="${field.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            fieldsList.appendChild(row);
        });
    }

    async createCompleteProduct() {
        if (!this.productData) {
            showAlert('error', 'Please fill in the basic product information');
            this.navigateTab('basic-info');
            return;
        }

        if (this.sections.length === 0) {
            showAlert('error', 'Please add at least one form section');
            this.navigateTab('form-sections');
            return;
        }

        try {
            // Show loading indicator
            showLoadingIndicator(true, 'Creating product...');

            // 1. Create the product
            const product = await ProductAPI.createProduct(this.productData);
            if (!product || !product.id) {
                throw new Error('Failed to create product');
            }

            this.currentProductId = product.id;

            // 2. Create all sections
            const createdSections = [];
            for (const section of this.sections) {
                const sectionData = {
                    product_id: this.currentProductId,
                    name: section.name,
                    description: section.description,
                    order: section.order,
                    is_required: section.is_required,
                    is_active: section.is_active
                };

                const createdSection = await ProductAPI.createFormSection(this.currentProductId, sectionData);
                if (createdSection && createdSection.id) {
                    // Store mapping from temporary to real ID
                    createdSections.push({
                        tempId: section.id,
                        realId: createdSection.id
                    });
                }
            }

            // 3. Create all fields
            for (const field of this.fields) {
                // Find the real section ID
                const sectionMapping = createdSections.find(s => s.tempId === field.section_id);
                if (!sectionMapping) continue;

                const fieldData = {
                    section_id: sectionMapping.realId,
                    label: field.label,
                    field_type: field.field_type,
                    placeholder: field.placeholder,
                    help_text: field.help_text,
                    default_value: null,
                    options: field.options,
                    order: field.order,
                    is_required: field.is_required,
                    is_active: field.is_active,
                    is_visible: field.is_visible,
                    is_admin_only: field.is_admin_only,
                    is_readonly: field.is_readonly
                };

                await ProductAPI.createFormField(sectionMapping.realId, fieldData);
            }

            // Success! Close modal and refresh product list
            showAlert('success', 'Product and form created successfully!');
            const modal = bootstrap.Modal.getInstance(document.getElementById('newProductModal'));
            modal.hide();

            // Reset state
            this.productData = null;
            this.sections = [];
            this.fields = [];
            this.currentProductId = null;

            // Refresh product list
            loadProducts();

            // Hide loading indicator
            showLoadingIndicator(false);
        } catch (error) {
            console.error('Error creating product:', error);
            showAlert('error', 'Failed to create product: ' + (error.message || 'Unknown error'));
            showLoadingIndicator(false);
        }
    }
}

// Show/hide loading indicator
function showLoadingIndicator(show, message = 'Loading...') {
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingMessage = document.getElementById('loading-message');

    if (loadingIndicator && loadingMessage) {
        if (show) {
            loadingMessage.textContent = message;
            loadingIndicator.style.display = 'flex';
        } else {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Initialize product form handlers when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('Product utils: DOM Content Loaded');

    // Elements - using safeGetElement to handle null checks
    const productSelect = safeGetElement('productSelect');
    const leadSelect = safeGetElement('leadSelect');
    const formContainer = safeGetElement('formContainer');
    const productDetails = safeGetElement('productDetails');
    const leadDetails = safeGetElement('leadDetails');
    const viewLeadBtn = safeGetElement('viewLeadBtn');
    const newProductBtn = safeGetElement('newProductBtn');
    // Note: 'createProductBtn' ID doesn't exist in the HTML - using 'completeProductCreationBtn' instead
    const createProductBtn = safeGetElement('completeProductCreationBtn');
    const productForm = safeGetElement('productForm');
    const cancelBtn = safeGetElement('cancelBtn');
    const addObligationRowBtn = safeGetElement('addObligationRow');
    const dynamicFormContainer = safeGetElement('dynamic-form-container');
    const noProductMessage = safeGetElement('noProductMessage');
    const loadingIndicator = safeGetElement('loading-indicator');
    const loadingMessage = safeGetElement('loading-message');

    // Initialize product form builder
    productFormBuilder = new ProductFormBuilder();

    // Variables
    let selectedProductId = '';
    let selectedLeadId = '';
    let submissionId = '';
    let formSections = [];
    let formFields = {};
    let editMode = true;
    let isAdminUser = false; // Assume non-admin by default

    // Load Products and Leads
    loadProducts();
    loadLeads();

    console.log('Product utils: Setting up event listeners');

    // Set up event listeners only if elements exist
    if (productSelect) productSelect.addEventListener('change', handleProductChange);
    if (leadSelect) leadSelect.addEventListener('change', handleLeadChange);
    if (viewLeadBtn) viewLeadBtn.addEventListener('click', viewLeadDetails);
    if (newProductBtn) newProductBtn.addEventListener('click', showNewProductModal);
    if (createProductBtn) createProductBtn.addEventListener('click', createNewProduct);
    if (productForm) productForm.addEventListener('submit', saveProductForm);
    if (cancelBtn) cancelBtn.addEventListener('click', resetForm);
    if (addObligationRowBtn) addObligationRowBtn.addEventListener('click', addObligationRow);

    // Initialize financial calculation handlers
    initializeCalculations();

    // Handler Functions
    async function loadProducts() {
        const products = await ProductAPI.getProducts();

        productSelect.innerHTML = '<option value="" selected>Select a Product</option>';

        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product._id;
            option.textContent = product.name;
            productSelect.appendChild(option);
        });
    }

    async function loadLeads() {
        const leads = await ProductAPI.getLeads();

        leadSelect.innerHTML = '<option value="" selected>Select a Lead</option>';

        leads.forEach(lead => {
            const option = document.createElement('option');
            option.value = lead._id;
            option.textContent = `${lead.first_name} ${lead.last_name} (${lead.phone})`;
            leadSelect.appendChild(option);
        });
    }

    async function handleProductChange() {
        selectedProductId = productSelect.value;

        if (!selectedProductId) {
            productDetails.style.display = 'none';
            formContainer.style.display = 'none';
            return;
        }

        const product = await ProductAPI.getProductDetails(selectedProductId);

        if (product) {
            // Update product details
            document.getElementById('productCode').textContent = product._id || '-';
            document.getElementById('productStatus').textContent = product.status || 'Active';
            document.getElementById('productCreator').textContent = product.creator_name || '-';

            productDetails.style.display = 'block';

            // Check if we have a lead selected and load form
            if (selectedLeadId) {
                checkExistingSubmission();
            }
        }
    }

    async function handleLeadChange() {
        selectedLeadId = leadSelect.value;
        viewLeadBtn.disabled = !selectedLeadId;

        if (!selectedLeadId) {
            leadDetails.style.display = 'none';
            return;
        }

        const lead = await ProductAPI.getLeadDetails(selectedLeadId);

        if (lead) {
            // Hide the "no lead selected" message
            const noLeadMessage = document.getElementById('no-lead-message');
            if (noLeadMessage) {
                noLeadMessage.style.display = 'none';
            }

            // Show the lead details content
            const leadDetailsContent = document.getElementById('lead-details-content');
            if (leadDetailsContent) {
                leadDetailsContent.style.display = 'block';
            }

            // Update lead details
            document.getElementById('leadId').textContent = lead._id;
            document.getElementById('customerName').textContent = `${lead.first_name} ${lead.last_name}`;

            // Set lead status with appropriate class
            const statusBadge = document.getElementById('leadStatus');
            statusBadge.textContent = lead.status_name || 'New';
            statusBadge.className = 'badge';

            if (lead.status_name) {
                const status = lead.status_name.toLowerCase();
                if (status.includes('new')) {
                    statusBadge.classList.add('bg-primary');
                } else if (status.includes('contacted') || status.includes('progress')) {
                    statusBadge.classList.add('bg-info');
                } else if (status.includes('qualified') || status.includes('interested')) {
                    statusBadge.classList.add('bg-warning', 'text-dark');
                } else if (status.includes('proposal') || status.includes('negotiation')) {
                    statusBadge.classList.add('bg-secondary');
                } else if (status.includes('won') || status.includes('closed')) {
                    statusBadge.classList.add('bg-success');
                } else if (status.includes('lost') || status.includes('rejected')) {
                    statusBadge.classList.add('bg-danger');
                } else {
                    statusBadge.classList.add('bg-secondary');
                }
            } else {
                statusBadge.classList.add('bg-primary');
            }

            document.getElementById('customerPhone').textContent = lead.phone || '-';

            // Show the view lead button
            viewLeadBtn.style.display = 'inline-block';

            leadDetails.style.display = 'block';

            // Pre-fill customer name in the form
            if (document.getElementById('customerName')) {
                document.getElementById('customerName').value = `${lead.first_name} ${lead.last_name}`;
            }

            // Check if we have a product selected and load form
            if (selectedProductId) {
                checkExistingSubmission();
            }
        }
    }

    async function checkExistingSubmission() {
        if (!selectedLeadId || !selectedProductId) return;

        try {
            const submissions = await ProductAPI.getLeadFormSubmissions(selectedLeadId);
            const matchingSubmission = submissions.find(sub => sub.product_id === selectedProductId);

            if (matchingSubmission) {
                // We have an existing submission, load it
                submissionId = matchingSubmission._id;
                const submission = await ProductAPI.getFormSubmission(submissionId);

                if (submission) {
                    // Hide the no product message
                    if (noProductMessage) {
                        noProductMessage.style.display = 'none';
                    }

                    // Fill form with submission data
                    formContainer.style.display = 'block';
                    fillFormWithSubmissionData(submission);
                }
            } else {
                // No existing submission, show empty form
                submissionId = '';

                // Hide the no product message
                if (noProductMessage) {
                    noProductMessage.style.display = 'none';
                }

                formContainer.style.display = 'block';
                resetFormFields();
            }
        } catch (error) {
            console.error('Error checking for existing submissions:', error);
            showAlert('error', 'Failed to check for existing submissions: ' + (error.message || 'Unknown error'));
        }
    }

    function fillFormWithSubmissionData(submission) {
        const formData = submission.form_data || {};

        // Fill form fields with data from submission
        // This is a simplified version that assumes field IDs match the submission data keys
        Object.entries(formData).forEach(([key, value]) => {
            const field = document.getElementById(key);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = !!value;
                } else {
                    field.value = value;
                }
            }
        });

        // Set submission ID field
        if (document.getElementById('submissionId')) {
            document.getElementById('submissionId').value = submission._id;
        }

        // Set status if available
        if (submission.status && document.getElementById('leadStatusSelect')) {
            document.getElementById('leadStatusSelect').value = submission.status;
        }

        // Update calculated fields
        calculateIncome();
        calculateTotals();
        calculateEligibility();
    }

    function viewLeadDetails() {
        if (!selectedLeadId) return;

        window.location.href = `leads.html?id=${selectedLeadId}`;
    }

    function showNewProductModal() {
        console.log('Opening new product modal');
        // Reset the form state
        document.getElementById('productBasicInfoForm').reset();
        document.getElementById('sectionForm').reset();
        document.getElementById('fieldForm').reset();

        // Reset the product form builder state
        productFormBuilder.productData = null;
        productFormBuilder.sections = [];
        productFormBuilder.fields = [];
        productFormBuilder.currentProductId = null;

        // Clear the sections and fields lists
        document.getElementById('sectionsList').innerHTML = '';
        document.getElementById('fieldsList').innerHTML = '';
        document.getElementById('optionsList').innerHTML = '';

        // Reset to the first tab
        const firstTab = document.getElementById('basic-info-tab');
        const tab = new bootstrap.Tab(firstTab);
        tab.show();

        // Show the modal
        const modalElement = document.getElementById('newProductModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }

    async function createNewProduct() {
        // This has been replaced by the more comprehensive product form builder
        // The old direct product creation function is now obsolete
        showAlert('info', 'Please use the product builder to create a complete product with form fields');
    }

    // Save product form
    async function saveProductForm(e) {
        e.preventDefault();

        try {
            // Get all form data
            const formData = collectFormData();

            // Validate the form
            const validation = FormValidator.validateForm(document.getElementById('product-form'), Object.values(formFields));

            if (!validation.isValid) {
                // Display validation errors
                showAlert('error', 'Please fix the validation errors before submitting.');

                // Scroll to the first error
                if (validation.errors.length > 0) {
                    const firstErrorField = document.getElementById(validation.errors[0].field);
                    if (firstErrorField) {
                        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        firstErrorField.focus();
                    }
                }

                return;
            }

            // Check if required product and lead are selected
            if (!selectedProductId) {
                showAlert('error', 'Please select a product.');
                return;
            }

            if (!selectedLeadId) {
                showAlert('error', 'Please select a lead.');
                return;
            }

            // Get form submission status
            const statusSelect = document.getElementById('submission-status-select');
            const status = statusSelect ? statusSelect.value : 'draft';

            // Prepare submission data
            const submissionData = {
                product_id: selectedProductId,
                lead_id: selectedLeadId,
                form_data: formData,
                status: status
            };

            showLoadingIndicator(true, 'Saving form...');

            let result;
            if (formSubmissionId) {
                // Update existing submission
                result = await ProductAPI.updateFormSubmission(formSubmissionId, submissionData);
            } else {
                // Create new submission
                result = await ProductAPI.createFormSubmission(submissionData);
                if (result && result.id) {
                    formSubmissionId = result.id;
                }
            }

            if (result) {
                showAlert('success', 'Form saved successfully.');

                // Update status display
                updateFormStatusDisplay(result.status, result.updated_at || result.created_at);

                // If form is submitted or approved, switch to read-only mode
                if (result.status === 'submitted' || result.status === 'approved') {
                    editMode = false;
                    if (editModeToggle) editModeToggle.checked = false;
                    applyEditModeState();
                }
            } else {
                showAlert('error', 'Failed to save form.');
            }

            showLoadingIndicator(false);
        } catch (error) {
            console.error('Error saving product form:', error);
            showAlert('error', 'Failed to save form: ' + (error.response?.data?.detail || error.message || 'Unknown error'));
            showLoadingIndicator(false);
        }
    }

    // Collect all form data including special fields like obligations
    function collectFormData() {
        const formData = {};

        // Get all regular form fields
        const formElements = document.querySelectorAll('#dynamic-form-container input, #dynamic-form-container select, #dynamic-form-container textarea');

        formElements.forEach(element => {
            if (element.name) {
                const fieldConfig = formFields[element.name];

                // Skip admin-only fields for non-admin users
                if (fieldConfig && fieldConfig.is_admin_only && !isAdminUser) {
                    return;
                }

                // Skip fields user doesn't have permission to edit if in edit mode
                if (editMode && fieldConfig && !fieldConfig.can_edit && !isAdminUser) {
                    return;
                }

                // Handle different input types
                if (element.type === 'checkbox') {
                    formData[element.name] = element.checked;
                } else if (element.type === 'number') {
                    formData[element.name] = element.value ? parseFloat(element.value) : null;
                } else if (element.type === 'radio') {
                    if (element.checked) {
                        formData[element.name] = element.value;
                    }
                } else {
                    formData[element.name] = element.value;
                }
            }
        });

        // Get obligation table data
        const obligationsTable = document.getElementById('obligations-table');
        if (obligationsTable) {
            const obligationRows = obligationsTable.querySelectorAll('tbody tr');
            const obligations = [];

            obligationRows.forEach(row => {
                const obligationType = row.querySelector('[name="obligationType"]')?.value;
                const obligationLender = row.querySelector('[name="obligationLender"]')?.value;
                const obligationLoan = row.querySelector('[name="obligationLoan"]')?.value;
                const obligationEmi = row.querySelector('[name="obligationEmi"]')?.value;
                const obligationTenure = row.querySelector('[name="obligationTenure"]')?.value;

                if (obligationType || obligationLender || obligationLoan || obligationEmi) {
                    obligations.push({
                        type: obligationType,
                        lender: obligationLender,
                        loan_amount: obligationLoan ? parseFloat(obligationLoan) : null,
                        emi: obligationEmi ? parseFloat(obligationEmi) : null,
                        tenure: obligationTenure ? parseInt(obligationTenure) : null
                    });
                }
            });

            formData.obligations = obligations;
        }

        // Get calculation fields
        const calculationFields = [
            'monthly_income', 'total_obligations', 'foir_amount',
            'emi_eligibility', 'multiplier_eligibility', 'final_eligibility'
        ];

        calculationFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                // Remove currency formatting and convert to number
                let value = element.value;
                if (value) {
                    value = value.replace(/[₹,\s]/g, '');
                    formData[field] = parseFloat(value);
                }
            }
        });

        return formData;
    }
});

// Global Functions for calculations (need to be global for inline event handlers)

// Calculate total income
function calculateIncome() {
    try {
        const monthlySalary = parseFloat(document.getElementById('monthly_salary')?.value || 0);
        const partnerSalary = parseFloat(document.getElementById('partner_salary')?.value || 0);
        const yearlyBonus = parseFloat(document.getElementById('yearly_bonus')?.value || 0);
        const otherIncome = parseFloat(document.getElementById('other_income')?.value || 0);

        // Calculate monthly income (yearly bonus divided by 12)
        const monthlyBonus = yearlyBonus / 12;
        const totalMonthlyIncome = monthlySalary + partnerSalary + monthlyBonus + otherIncome;

        // Update monthly income field
        const monthlyIncomeField = document.getElementById('monthly_income');
        if (monthlyIncomeField) {
            monthlyIncomeField.value = FinancialCalculator.formatCurrency(totalMonthlyIncome);
        }

        return totalMonthlyIncome;
    } catch (error) {
        console.error('Error calculating income:', error);
        return 0;
    }
}

// Calculate eligibility
function calculateEligibility() {
    try {
        // Get monthly income
        const monthlyIncome = calculateIncome();

        // Get total obligations
        const totalObligations = calculateTotals();

        // Get FOIR percentage
        const foirPercent = parseFloat(document.getElementById('foir_percent')?.value || 0);

        // Calculate FOIR amount
        const foirAmount = (monthlyIncome * foirPercent) / 100;
        const foirAmountField = document.getElementById('foir_amount');
        if (foirAmountField) {
            foirAmountField.value = FinancialCalculator.formatCurrency(foirAmount);
        }

        // Get rate of interest
        const roi = parseFloat(document.getElementById('roi')?.value || 0);

        // Get tenure
        const tenureMonths = parseInt(document.getElementById('tenure_months')?.value || 0);

        // Calculate EMI eligibility
        const emiEligibility = FinancialCalculator.calculateLoanEligibility(
            monthlyIncome, totalObligations, foirPercent, roi, tenureMonths
        );

        const emiEligibilityField = document.getElementById('emi_eligibility');
        if (emiEligibilityField) {
            emiEligibilityField.value = FinancialCalculator.formatCurrency(emiEligibility);
        }

        // Calculate multiplier eligibility
        const multiplier = parseFloat(document.getElementById('multiplier')?.value || 0);
        const multiplierEligibility = FinancialCalculator.calculateMultiplierEligibility(monthlyIncome, multiplier);

        const multiplierEligibilityField = document.getElementById('multiplier_eligibility');
        if (multiplierEligibilityField) {
            multiplierEligibilityField.value = FinancialCalculator.formatCurrency(multiplierEligibility);
        }

        // Determine final eligibility (minimum of both)
        const finalEligibility = Math.min(emiEligibility, multiplierEligibility);

        const finalEligibilityField = document.getElementById('final_eligibility');
        if (finalEligibilityField) {
            finalEligibilityField.value = FinancialCalculator.formatCurrency(finalEligibility);
        }

        return {
            monthlyIncome,
            totalObligations,
            foirAmount,
            emiEligibility,
            multiplierEligibility,
            finalEligibility
        };
    } catch (error) {
        console.error('Error calculating eligibility:', error);
        return {
            monthlyIncome: 0,
            totalObligations: 0,
            foirAmount: 0,
            emiEligibility: 0,
            multiplierEligibility: 0,
            finalEligibility: 0
        };
    }
}

// Calculate obligation totals
function calculateTotals() {
    try {
        const obligationsTable = document.getElementById('obligations-table');
        if (!obligationsTable) return 0;

        const emiCells = obligationsTable.querySelectorAll('tbody td:nth-child(4) input');
        let totalObligations = 0;

        emiCells.forEach(cell => {
            const emi = parseFloat(cell.value || 0);
            if (!isNaN(emi)) {
                totalObligations += emi;
            }
        });

        // Update total obligations field
        const totalObligationsField = document.getElementById('total_obligations');
        if (totalObligationsField) {
            totalObligationsField.value = FinancialCalculator.formatCurrency(totalObligations);
        }

        return totalObligations;
    } catch (error) {
        console.error('Error calculating totals:', error);
        return 0;
    }
}

// Calculate EMI for an obligation row
function calculateRowEMI(row) {
    try {
        const loanAmountInput = row.querySelector('[name="obligationLoan"]');
        const emiInput = row.querySelector('[name="obligationEmi"]');
        const tenureInput = row.querySelector('[name="obligationTenure"]');

        if (loanAmountInput && emiInput && tenureInput) {
            const loanAmount = parseFloat(loanAmountInput.value || 0);
            const tenure = parseInt(tenureInput.value || 0);

            // Assume a default interest rate if not specified
            const roi = 10; // 10% annual interest rate

            if (loanAmount > 0 && tenure > 0) {
                const emi = FinancialCalculator.calculateEMI(loanAmount, roi, tenure);
                emiInput.value = emi;
            }
        }

        // Recalculate totals after updating EMI
        calculateTotals();
        calculateEligibility();
    } catch (error) {
        console.error('Error calculating row EMI:', error);
    }
}

// Form builder validation methods
class FormBuilderValidator {
    static validateProductBasicInfo(productData) {
        if (!productData.name || productData.name.trim() === '') {
            return { isValid: false, message: 'Product name is required' };
        }

        if (!productData.category || productData.category.trim() === '') {
            return { isValid: false, message: 'Product category is required' };
        }

        return { isValid: true };
    }

    static validateSection(sectionData) {
        if (!sectionData.name || sectionData.name.trim() === '') {
            return { isValid: false, message: 'Section name is required' };
        }

        if (isNaN(sectionData.order) || sectionData.order < 1) {
            return { isValid: false, message: 'Section order must be a positive number' };
        }

        return { isValid: true };
    }

    static validateField(fieldData) {
        if (!fieldData.section_id) {
            return { isValid: false, message: 'Please select a section for this field' };
        }

        if (!fieldData.label || fieldData.label.trim() === '') {
            return { isValid: false, message: 'Field label is required' };
        }

        if (!fieldData.field_type) {
            return { isValid: false, message: 'Field type is required' };
        }

        if (['select', 'checkbox', 'radio'].includes(fieldData.field_type) &&
            (!fieldData.options || fieldData.options.length === 0)) {
            return { isValid: false, message: 'Please add at least one option for this field type' };
        }

        if (isNaN(fieldData.order) || fieldData.order < 1) {
            return { isValid: false, message: 'Field order must be a positive number' };
        }

        return { isValid: true };
    }

    static validateFormBuilder(builder) {
        // Validate product data
        if (!builder.productData) {
            return { isValid: false, message: 'Please complete the product basic information' };
        }

        const productValidation = this.validateProductBasicInfo(builder.productData);
        if (!productValidation.isValid) {
            return productValidation;
        }

        // Validate sections
        if (builder.sections.length === 0) {
            return { isValid: false, message: 'Please add at least one form section' };
        }

        // We don't need to validate each section here as they are validated when added

        // Validate that fields exist
        if (builder.fields.length === 0) {
            return { isValid: false, message: 'Please add at least one form field' };
        }

        return { isValid: true };
    }
}
