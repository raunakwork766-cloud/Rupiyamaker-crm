import { useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ListTodo,
  Edit2,
  User,
} from "lucide-react"
import AboutSection from "./sections/AboutSection"
import HowToProcessSection from "./sections/HowToProcessSection"
import ImportantQuestionsSection from "./sections/ImportantQuestionsSection"
import LoginFormSection from "./sections/LoginFormSection"
import Task from "./Task"
import LeadActivity from "./LeadActivity"
import RemarkSection from "./Remark"
import Attachments from "./sections/Attachments"
import TaskComponent from "./sections/TaskSectionInLead"

const statusCardConfig = [
  {
    key: "not_a_lead",
    label: "NOT A LEAD",
    icon: ListTodo,
    gradient: "from-blue-500 via-indigo-500 to-cyan-400",
  },
  {
    key: "active_leads",
    label: "ACTIVE LEADS",
    icon: CheckCircle,
    gradient: "from-green-500 via-teal-500 to-emerald-400",
  },
  {
    key: "lost_by_mistake",
    label: "LOST BY MISTAKE",
    icon: AlertTriangle,
    gradient: "from-amber-500 via-pink-500 to-pink-400",
  },
  {
    key: "lost_lead",
    label: "LOST LEAD",
    icon: XCircle,
    gradient: "from-red-500 via-fuchsia-600 to-pink-400",
  },
]

const dummyLeads = [
  {
    leadDate: "2025-06-15",
    createdBy: "Admin",
    campaignName: "Online Campaign",
    teamName: "Team Alpha",
    customerName: "Arjun Mehta",
    status: "Active Login",
    action: "Edit",
    salary: "₹75,000",
    eligibility: "₹12,00,000",
    loanAmountApplied: "₹10,00,000",
    companyCategory: "Category A",
    pinCode: "110011, New Delhi",
    obligation: "₹1,50,000",
    btPost: "₹50,000",
    id: "PL3",
    dataCode: "MONEY MAKER01",
    alternateNumber: "8826370425",
    productName: "PL3",
    crmData: "9354642156",
    mobileNumber: "9354642156",
  },
  {
    leadDate: "2025-06-17",
    createdBy: "Priya Singh",
    campaignName: "Offline Drive",
    teamName: "Team Beta",
    customerName: "Sunil Kumar",
    status: "Approved",
    action: "Edit",
    salary: "₹62,000",
    eligibility: "₹9,00,000",
    loanAmountApplied: "₹8,00,000",
    companyCategory: "Category B",
    pinCode: "400001, Mumbai",
    obligation: "₹80,000",
    btPost: "₹40,000",
    id: "PL2",
    dataCode: "MONEY MAKER02",
    alternateNumber: "8826370426",
    productName: "PL2",
    crmData: "9354642157",
    mobileNumber: "9354642157",
  },
  {
    leadDate: "2025-06-19",
    createdBy: "Neha Jain",
    campaignName: "Partner Channel",
    teamName: "Team Gamma",
    customerName: "Vikas Sharma",
    status: "Disbursed",
    action: "Edit",
    salary: "₹85,000",
    eligibility: "₹15,00,000",
    loanAmountApplied: "₹14,00,000",
    companyCategory: "Category C",
    pinCode: "500081, Hyderabad",
    obligation: "₹2,00,000",
    btPost: "₹80,000",
    id: "PL1",
    dataCode: "MONEY MAKER03",
    alternateNumber: "8826370427",
    productName: "PL1",
    crmData: "9354642158",
    mobileNumber: "9354642158",
  },
]

const COLUMN_SELECT_OPTIONS = {
  status: {
    primary: ["Not a Lead", "Lead"],
    leadSubOptions: [
      "Active Lead",
      "Hot Lead", 
      "Warm Lead",
      "Cold Lead",
      "Closed Lead",
      "Lost Lead",
      "Lost By Mistake",
      "Follow Up",
      "Converted",
      "Approved",
      "Disbursed"
    ]
  },
  action: ["Edit", "Call", "Email", "Meet", "Follow Up", "Closed"],
}

const ABOUT_EDITABLE_FIELDS = [
  {
    key: "status",
    label: "STATUS",
    options: COLUMN_SELECT_OPTIONS.status.leadSubOptions,
  },
  {
    key: "action",
    label: "ACTION",
    options: COLUMN_SELECT_OPTIONS.action,
  },
]

const detailSections = [
  {
    label: "LEAD DETAILS",
    icon: <span className="mr-1">🏠</span>,
    getContent: (lead, handleFieldChange) => [
      {
        label: "ABOUT",
        content: (
          <AboutSection lead={lead} />
        ),  
      },
      {
        label: "HOW TO PROCESS",
        content: (
          <HowToProcessSection lead={lead} handleFieldChange={handleFieldChange} />
        ),
      },
      {
        label: "IMPORTANT QUESTION",
        content: (
          <ImportantQuestionsSection lead={lead} handleFieldChange={handleFieldChange} />
        ),
      },
    ],
  },
  {
    label: "OBLIGATION",
    getContent: (leadData, handleChangeFunc) => [ // Renamed parameters to avoid confusion with outer scope 'lead' and 'handleFieldChange'
      {
        label: "OBLIGATION",
        content: (
          <div className="p-4 rounded-2xl border-2 border-cyan-400/70 bg-white shadow-2xl relative overflow-hidden">
            {/* First Row: SALARY, PARTNER'S SALARY, BONUS PART */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="salary">SALARY</label>
                <input
                  id="salary"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.salary || ""}
                  onChange={e => handleChangeFunc("salary", e.target.value)}
                />
              </div>
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="partnerSalary">PARTNER'S SALARY</label>
                <input
                  id="partnerSalary"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.partnerSalary || ""}
                  onChange={e => handleChangeFunc("partnerSalary", e.target.value)}
                />
              </div>
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="bonusPart">BONUS PART</label>
                <input
                  id="bonusPart"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.bonusPart || ""}
                  onChange={e => handleChangeFunc("bonusPart", e.target.value)}
                />
                <div className="flex items-center mt-3">
                  <div className="font-bold text-[#03b0f5] mr-2 text-base" style={{ fontSize: "0.8rem" }}>Divide By:</div>
                  <div className="flex gap-2">
                    {[3, 6, 12, 24].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`px-2 py-1 rounded border-2 border-[#03b0f5] text-[#03b0f5] font-bold hover:bg-[#03b0f5] hover:text-white transition text-base`}
                        style={{
                          fontSize: "0.8rem",
                          backgroundColor: leadData.divideBy === num ? "#03b0f5" : undefined,
                          color: leadData.divideBy === num ? "#fff" : undefined,
                        }}
                        onClick={() => handleChangeFunc("divideBy", num)}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* --- */}

            {/* Second Row: LOAN AMOUNT REQUIRED, COMPANY NAME (now dropdown) */}
            <div className="flex flex-wrap md:flex-nowrap gap-x-5 gap-y-4 mt-4">
              <div className="w-full md:w-1/2">
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="loanAmountRequired">LOAN AMOUNT REQUIRED</label>
                <input
                  id="loanAmountRequired"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.loanAmountRequired || ""}
                  onChange={e => handleChangeFunc("loanAmountRequired", e.target.value)}
                />
              </div>
              <div className="w-full md:w-1/2">
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="companyName">COMPANY NAME</label>
                <select
                  id="companyName"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.companyName || ""}
                  onChange={e => handleChangeFunc("companyName", e.target.value)}
                >
                  <option value="">Select Company</option> {/* Default/placeholder option */}
                  <option value="companyA">Company A Ltd.</option>
                  <option value="companyB">B Industries</option>
                  <option value="companyC">C Corp</option>
                  <option value="companyD">D Solutions</option>
                  {/* Add more company options as needed */}
                </select>
              </div>
            </div>

            {/* --- */}

            {/* Third Row: COMPANY TYPE, COMPANY CATEGORY */}
            <div className="flex flex-wrap md:flex-nowrap gap-x-5 gap-y-4 mt-4">
              <div className="w-full md:w-1/2">
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="companyType">COMPANY TYPE</label>
                <select
                  id="companyType"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.companyType || ""}
                  onChange={e => handleChangeFunc("companyType", e.target.value)}
                >
                  <option value="">Select Type</option> {/* Default/placeholder option */}
                  <option value="public">Public Company</option>
                  <option value="private">Private Company</option>
                  <option value="llc">LLC</option>
                  <option value="partnership">Partnership</option>
                  {/* Add more options as needed */}
                </select>
              </div>
              <div className="w-full md:w-1/2">
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="companyCategory">COMPANY CATEGORY</label>
                <select
                  id="companyCategory"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.companyCategory || ""}
                  onChange={e => handleChangeFunc("companyCategory", e.target.value)}
                >
                  <option value="">Select Category</option> {/* Default/placeholder option */}
                  <option value="technology">Technology</option>
                  <option value="finance">Finance</option>
                  <option value="retail">Retail</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="manufacturing">Manufacturing</option>
                  {/* Add more options as needed */}
                </select>
              </div>
            </div>

            {/* Fourth Row: BT POS, OBLIGATION (Read-only), CIBIL SCORE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4 mt-4">
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="btPos">BT POS</label>
                <input
                  id="btPos"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.btPos || ""}
                  readOnly
                />
              </div>
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="obligationReadOnly">OBLIGATION</label>
                <input
                  id="obligationReadOnly"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.obligationReadOnly || ""}
                  readOnly
                />
              </div>
              <div>
                <label className="font-extrabold text-[#00AEEF] text-base mb-1 block" htmlFor="cibilScore">CIBIL SCORE</label>
                <input
                  id="cibilScore"
                  type="text"
                  className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"
                  style={{ fontSize: "0.8rem" }}
                  value={leadData.cibilScore || ""}
                  onChange={e => handleChangeFunc("cibilScore", e.target.value)}
                />
              </div>
            </div>

            {/* --- New Table Section --- */}
            <div className="mt-6 border-t-2 border-cyan-400/70 pt-4">
              <h3 className="font-extrabold text-[#00AEEF] text-lg mb-4">EXISTING OBLIGATIONS</h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Name</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tenure</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ROI%</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Loan</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Outstanding</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">EMI</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Map over the obligations array to render rows */}
                    {(leadData.obligations || []).map((obligation, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* PRODUCT Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.product || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* BANK NAME Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.bankName || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* TENURE Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.tenure || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* ROI% Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.roi || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* TOTAL LOAN Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.totalLoan || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* OUTSTANDING Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.outstanding || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {/* EMI Field - Read-only text input */}
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-cyan-400 rounded text-black font-bold bg-gray-100 cursor-not-allowed"
                            style={{ fontSize: "0.8rem" }}
                            value={obligation.emi || ""}
                            readOnly // Make this field read-only
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 ml-2"
                              onClick={() => {
                                const newObligations = [...leadData.obligations];
                                newObligations.splice(index, 1);
                                handleChangeFunc("obligations", newObligations);
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="mt-4 w-full  md:w-auto px-4 py-2 border-2 border-[#00AEEF] text-[#00AEEF] font-bold rounded-lg flex items-center justify-center hover:bg-[#00AEEF] hover:text-white transition"
                onClick={() => {
                  const newObligations = leadData.obligations ? [...leadData.obligations] : [];
                  newObligations.push({
                    product: "",
                    bankName: "",
                    tenure: "",
                    roi: "",
                    totalLoan: "",
                    outstanding: "",
                    emi: ""
                  });
                  handleChangeFunc("obligations", newObligations);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Obligation
              </button>
            </div>
            {/* --- End New Table Section --- */}
          </div>
        )
      }
    ]
  },
  {
    label: "LOGIN FORM",
    getContent: (leadData, handleChangeFunc) => [
      {
        label: "LOGIN FORM",
        content: (
          <LoginFormSection leadData={leadData} handleChangeFunc={handleChangeFunc} />
        ),
      },
    ],
  },
  {
    label: "REMARK",
    getContent: (leadData, handleChangeFunc) => [
      {
        label: "REMARK",
        content: (
          <div className="p-6 bg-white rounded-xl shadow-2xl text-[1rem] text-gray-100 border-l-4 border-cyan-500/60">
            <RemarkSection />
          </div>
        ),
      },
    ],
  },
  {
    label: "TASK",
    getContent: (lead) => [
      {
        label: "TASK",
        content: (
          <div className="shadow text-[1rem] text-[#03b0f5] bg-black p-4 rounded-xl">
            <div className="font-bold text-cyan-400 mb-2"><TaskComponent /></div>
          </div>
        ),
      },
    ],
  },
  {
  label: "ATTACHEMENT",
  getContent: (lead) => [
    {
      label: "ATTACHEMENT",
      content: (
        <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
          <Attachments />
        </div>
      ),
    },
  ],
},
  {
    label: "LEADS ACTIVITY",
    getContent: (lead) => [
      {
        label: "LEADS ACTIVITY",
        content: (
          <div className="p-4 bg-white rounded-xl shadow text-[1rem] text-[#03b0f5] border-l-4 border-cyan-400/40">
            <div className="font-bold text-cyan-400 mb-2">
              <LeadActivity 
                leadId={lead?._id || lead?.id} 
                userId={localStorage.getItem('userId')}
                leadData={lead}
              />
            </div>
          </div>
        ),
      },
    ],
  },
];

export default function HomeLoanUpdates() {
  const [leads, setLeads] = useState(dummyLeads)
  const [loading, setLoading] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editedLeads, setEditedLeads] = useState(leads)
  const [checkboxVisible, setCheckboxVisible] = useState(false)
  const [checkedRows, setCheckedRows] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [openSection, setOpenSection] = useState(0)
  const rowRefs = useRef({})
  
  // Status selection state for hierarchical dropdown
  const [statusSelections, setStatusSelections] = useState({})
  
  // Filter popup states
  const [showFilterPopup, setShowFilterPopup] = useState(false)
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('leads')
  const [filterOptions, setFilterOptions] = useState({
    leadStatus: '',
    dateFrom: '',
    dateTo: '',
    teamName: '',
    campaignName: '',
    createdBy: ''
  })

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
  // Accordion state for LEAD DETAILS tab
  const [openLeadSections, setOpenLeadSections] = useState({
    about: true,
    howToProcess: false,
    loginForm: false,
    importantQuestions: false,
  });

  const toggleLeadSection = (section) => {
    setOpenLeadSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Compute filtered leads based on filter options and search term
  const filteredLeads = editedLeads.filter(lead => {
    // First apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        (lead.customerName && lead.customerName.toLowerCase().includes(searchLower)) ||
        (lead.leadDate && lead.leadDate.toLowerCase().includes(searchLower)) ||
        (lead.createdBy && lead.createdBy.toLowerCase().includes(searchLower)) ||
        (lead.campaignName && lead.campaignName.toLowerCase().includes(searchLower)) ||
        (lead.teamName && lead.teamName.toLowerCase().includes(searchLower)) ||
        (lead.status && lead.status.toLowerCase().includes(searchLower)) ||
        (lead.action && lead.action.toLowerCase().includes(searchLower)) ||
        (lead.salary && lead.salary.toString().includes(searchLower)) ||
        (lead.eligibility && lead.eligibility.toString().includes(searchLower)) ||
        (lead.loanAmountApplied && lead.loanAmountApplied.toString().includes(searchLower)) ||
        (lead.companyCategory && lead.companyCategory.toLowerCase().includes(searchLower)) ||
        (lead.pinCode && lead.pinCode.toString().includes(searchLower)) ||
        (lead.obligation && lead.obligation.toString().includes(searchLower)) ||
        (lead.btPost && lead.btPost.toString().includes(searchLower)) ||
        (lead.mobileNumber && lead.mobileNumber.toString().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Then apply other filters
    // Filter by lead status
    if (filterOptions.leadStatus && lead.status !== filterOptions.leadStatus) {
      return false
    }
    
    // Filter by team name
    if (filterOptions.teamName && lead.teamName !== filterOptions.teamName) {
      return false
    }
    
    // Filter by campaign name
    if (filterOptions.campaignName && lead.campaignName !== filterOptions.campaignName) {
      return false
    }
    
    // Filter by created by
    if (filterOptions.createdBy && lead.createdBy !== filterOptions.createdBy) {
      return false
    }
    
    // Filter by date range
    if (filterOptions.dateFrom || filterOptions.dateTo) {
      const leadDate = new Date(lead.leadDate || lead.date || lead.createdAt || lead.dateCreated)
      
      if (filterOptions.dateFrom) {
        const fromDate = new Date(filterOptions.dateFrom)
        if (leadDate < fromDate) return false
      }
      
      if (filterOptions.dateTo) {
        const toDate = new Date(filterOptions.dateTo)
        toDate.setHours(23, 59, 59, 999) // Include full day
        if (leadDate > toDate) return false
      }
    }
    
    return true
  })

  // Get unique teams and creators dynamically from the data
  const getUniqueTeams = () => {
    return [...new Set(editedLeads.map(lead => lead.teamName).filter(Boolean))].sort()
  }

  const getUniqueCreators = () => {
    return [...new Set(editedLeads.map(lead => lead.createdBy).filter(Boolean))].sort()
  }

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (filterOptions.leadStatus) count++
    if (filterOptions.dateFrom || filterOptions.dateTo) count++
    if (filterOptions.teamName) count++
    if (filterOptions.campaignName) count++
    if (filterOptions.createdBy) count++
    return count
  }

  // Get filter count for specific category
  const getFilterCategoryCount = (category) => {
    switch (category) {
      case 'leads':
        return filterOptions.leadStatus ? 1 : 0
      case 'date':
        return (filterOptions.dateFrom || filterOptions.dateTo) ? 1 : 0
      case 'team':
        return filterOptions.teamName ? 1 : 0
      case 'createdBy':
        return filterOptions.createdBy ? 1 : 0
      case 'other':
        return filterOptions.campaignName ? 1 : 0
      default:
        return 0
    }
  }

  function handleSelectedLeadFieldChange(field, value) {
    setSelectedLead(prev => ({ ...prev, [field]: value }))
    setEditedLeads(leads =>
      leads.map(l =>
        l.id === selectedLead.id ? { ...l, [field]: value } : l
      )
    )
  }

  const [statusCounts, setStatusCounts] = useState({
    not_a_lead: leads.filter(l => l.status === "Not A Lead").length,
    active_leads: leads.filter(l => l.status === "Active Login" || l.status === "Approved" || l.status === "Disbursed").length,
    lost_by_mistake: leads.filter(l => l.status === "Lost By Mistake").length,
    lost_lead: leads.filter(l => l.status === "Lost Lead").length,
  })

  useEffect(() => {
    setEditedLeads(leads)
    setStatusCounts({
      not_a_lead: leads.filter(l => l.status === "Not A Lead").length,
      active_leads: leads.filter(l => l.status === "Active Login" || l.status === "Approved" || l.status === "Disbursed").length,
      lost_by_mistake: leads.filter(l => l.status === "Lost By Mistake").length,
      lost_lead: leads.filter(l => l.status === "Lost Lead").length,
    })
  }, [leads])

  // Update status counts when filters change
  useEffect(() => {
    setStatusCounts({
      not_a_lead: filteredLeads.filter(l => l.status === "Not A Lead").length,
      active_leads: filteredLeads.filter(l => l.status === "Active Login" || l.status === "Approved" || l.status === "Disbursed").length,
      lost_by_mistake: filteredLeads.filter(l => l.status === "Lost By Mistake").length,
      lost_lead: filteredLeads.filter(l => l.status === "Lost Lead").length,
    })
  }, [filteredLeads])

  const columns = [
    { key: "index", label: "#", className: "text-center whitespace-nowrap" },
    { key: "leadDate", label: "LEAD DATE", className: "text-center whitespace-nowrap" },
    { key: "createdBy", label: "CREATED BY", className: "text-center whitespace-nowrap" },
    { key: "campaignName", label: "CAMPAIGN NAME", className: "text-center whitespace-nowrap" },
    { key: "teamName", label: "TEAM NAME", className: "text-center whitespace-nowrap" },
    { key: "customerName", label: "CUSTOMER NAME", className: "text-center whitespace-nowrap" },
    { key: "status", label: "STATUS", className: "text-center whitespace-nowrap" },
    { key: "action", label: "ACTION", className: "text-center whitespace-nowrap" },
    { key: "salary", label: "SALARY", className: "text-center whitespace-nowrap" },
    { key: "eligibility", label: "LOAN ELIGIBILITY AS PER FOIR", className: "text-center whitespace-nowrap" },
    { key: "loanAmountApplied", label: "LOAN AMOUNT REQUIRED", className: "text-center whitespace-nowrap" },
    { key: "companyCategory", label: "COMPANY CATEGORY", className: "text-center whitespace-nowrap" },
    { key: "pinCode", label: "PIN CODE & CITY", className: "text-center whitespace-nowrap" },
    { key: "obligation", label: "OBLIGATION", className: "text-center whitespace-nowrap" },
    { key: "btPost", label: "BT POST", className: "text-center whitespace-nowrap" },
  ]

  const handleShowCheckboxes = () => {
    setCheckboxVisible(true)
    setCheckedRows([])
    setEditRow(null)
    
    // Initialize status selections for all rows
    const initialStatusSelections = {}
    filteredLeads.forEach((lead, idx) => {
      const currentStatus = lead.status
      if (currentStatus === "Not a Lead") {
        initialStatusSelections[idx] = {
          primary: "Not a Lead",
          sub: ''
        }
      } else if (currentStatus && COLUMN_SELECT_OPTIONS.status.leadSubOptions.includes(currentStatus)) {
        initialStatusSelections[idx] = {
          primary: "Lead",
          sub: currentStatus
        }
      } else {
        initialStatusSelections[idx] = {
          primary: '',
          sub: ''
        }
      }
    })
    setStatusSelections(initialStatusSelections)
  }

  const handleCancelSelection = () => {
    setCheckboxVisible(false)
    setCheckedRows([])
    setEditRow(null)
    setStatusSelections({}) // Clear status selections
  }

  const handleDeleteSelected = () => {
    if (checkedRows.length === 0) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${checkedRows.length} selected lead${checkedRows.length > 1 ? 's' : ''}?`
    )
    
    if (confirmed) {
      // Update local state by filtering out deleted leads
      const newLeads = editedLeads.filter((_, index) => !checkedRows.includes(index))
      setLeads(newLeads)
      setEditedLeads(newLeads)
      
      // Reset selection state
      setCheckboxVisible(false)
      setCheckedRows([])
      setStatusSelections({}) // Clear status selections
      
      console.log(`Successfully deleted ${checkedRows.length} leads`)
    }
  }

  const handleCheckboxChange = (rowIdx) => {
    let newCheckedRows
    if (checkedRows.includes(rowIdx)) {
      newCheckedRows = checkedRows.filter((idx) => idx !== rowIdx)
      setCheckedRows(newCheckedRows)
      
      // Remove status selection when unchecking
      setStatusSelections(prev => {
        const updated = {...prev}
        delete updated[rowIdx]
        return updated
      })
    } else {
      newCheckedRows = [...checkedRows, rowIdx]
      setCheckedRows(newCheckedRows)
      
      // Initialize status selection based on current status
      const currentStatus = editedLeads[rowIdx].status
      if (currentStatus === "Not a Lead") {
        setStatusSelections(prev => ({
          ...prev,
          [rowIdx]: {
            primary: "Not a Lead",
            sub: ''
          }
        }))
      } else if (currentStatus && COLUMN_SELECT_OPTIONS.status.leadSubOptions.includes(currentStatus)) {
        setStatusSelections(prev => ({
          ...prev,
          [rowIdx]: {
            primary: "Lead",
            sub: currentStatus
          }
        }))
      } else {
        setStatusSelections(prev => ({
          ...prev,
          [rowIdx]: {
            primary: '',
            sub: ''
          }
        }))
      }
    }
  }

  const handleSelectChange = (rowIdx, colKey, value) => {
    const updated = [...editedLeads]
    updated[rowIdx] = { ...updated[rowIdx], [colKey]: value }
    setEditedLeads(updated)
  }

  const handleStatusPrimaryChange = (rowIdx, primaryStatus) => {
    setStatusSelections(prev => ({
      ...prev,
      [rowIdx]: {
        primary: primaryStatus,
        sub: ''
      }
    }))
    
    // If "Not a Lead" is selected, update the lead status directly
    if (primaryStatus === "Not a Lead") {
      handleSelectChange(rowIdx, "status", "Not a Lead")
    }
  }

  const handleStatusSubChange = (rowIdx, subStatus) => {
    setStatusSelections(prev => ({
      ...prev,
      [rowIdx]: {
        ...prev[rowIdx],
        sub: subStatus
      }
    }))
    
    // Update the lead status with the sub-option
    handleSelectChange(rowIdx, "status", subStatus)
  }

  const handleRowBlur = () => {
    setTimeout(() => {
      // stay in selection mode
    }, 100)
  }

  const allRowsChecked = checkedRows.length === editedLeads.length && editedLeads.length > 0

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedRows(filteredLeads.map((_, idx) => idx))
    } else {
      setCheckedRows([])
    }
  }

  const handleRowClick = (rowIdx) => {
    setSelectedLead(editedLeads[rowIdx])
    setActiveTab(0)
    setOpenSection(0)
  }

  const handleBackToTable = () => {
    setSelectedLead(null)
  }

  // --- SELECTED LEAD PAGE ---
  if (selectedLead) {
    if (activeTab === 0) {
      return (
        <div className="min-h-screen bg-black text-white text-[0.2rem]">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg">
            <button
              onClick={handleBackToTable}
              className="text-cyan-300 mr-2 px-2 py-1 text-xl font-bold rounded hover:bg-cyan-900/20 transition"
              aria-label="Back"
            >{"←"}</button>
            <User className="text-cyan-300 w-10 h-8 drop-shadow" />
            <h1 className="text-xl font-extrabold text-cyan-300 tracking-wide drop-shadow">{selectedLead.customerName}</h1>
            <div className="flex-1"></div>
            <div className="flex gap-2">
              <button className="bg-gradient-to-b from-cyan-400 to-blue-700 px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-[1rem]">
                COPY THIS LEAD
              </button>
              <button className="bg-gradient-to-b from-cyan-400 to-blue-700 px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-[1rem]">
                FILE SENT TO LOGIN
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 px-7 py-3 bg-black border-b border-[#232c3a]">
            {detailSections.map((tab, idx) => (
              <button
                key={tab.label}
                className={`
                  flex items-center px-6 py-2 rounded-3xl font-extrabold border shadow-md text-[1.05rem] transition
                  ${idx === activeTab
                    ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                    : "bg-white text-[#03B0F5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                  }
                  focus:outline-none
                `}
                style={{
                  boxShadow: idx === activeTab ? "0 4px 16px 0 #1cb5e080" : undefined,
                  cursor: "pointer",
                  letterSpacing: "0.01em"
                }}
                onClick={() => {
                  setActiveTab(idx);
                  setOpenSection(0);
                }}
              >
                {tab.icon || null}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Accordion for 4 Lead Sections */}
          <div className="px-2 py-6 max-w-7xl mx-auto">
            <div className="p-4 bg-[#000] shadow-2xl rounded-2xl space-y-3">
              {/* About Section */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-white shadow">
                <button
                  className="w-full text-left px-6 py-3 font-extrabold text-[#00AEEF] text-lg flex justify-between items-center focus:outline-none"
                  onClick={() => toggleLeadSection("about")}
                >
                  About
                  <span>{openLeadSections.about ? "▲" : "▼"}</span>
                </button>
                {openLeadSections.about && (
                  <div className="px-6 pb-5">
                    <AboutSection lead={selectedLead} />
                  </div>
                )}
              </div>
              {/* How to Process Section */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-white shadow">
                <button
                  className="w-full text-left px-6 py-3 font-extrabold text-[#00AEEF] text-lg flex justify-between items-center focus:outline-none"
                  onClick={() => toggleLeadSection("howToProcess")}
                >
                  How to Process
                  <span>{openLeadSections.howToProcess ? "▲" : "▼"}</span>
                </button>
                {openLeadSections.howToProcess && (
                  <div className="px-6 pb-5">
                    <HowToProcessSection lead={selectedLead} handleFieldChange={handleSelectedLeadFieldChange} />
                  </div>
                )}
              </div>
              {/* Login Form Section */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-white shadow">
                <button
                  className="w-full text-left px-6 py-3 font-extrabold text-[#00AEEF] text-lg flex justify-between items-center focus:outline-none"
                  onClick={() => toggleLeadSection("loginForm")}
                >
                  LOGIN FORM
                  <span>{openLeadSections.loginForm ? "▲" : "▼"}</span>
                </button>
                {openLeadSections.loginForm && (
                  <div className="px-6 pb-5">
                    <LoginFormSection
                      leadData={selectedLead}
                      handleChangeFunc={handleSelectedLeadFieldChange}
                      bankOptions={["HDFC", "ICICI", "SBI", "Axis"]}
                      mobileNumber={selectedLead.mobileNumber}
                      bankName={selectedLead.salaryAccountBank}
                    />
                  </div>
                )}
              </div>
              {/* Important Questions Section */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-white shadow">
                <button
                  className="w-full text-left px-6 py-3 font-extrabold text-[#00AEEF] text-lg flex justify-between items-center focus:outline-none"
                  onClick={() => toggleLeadSection("importantQuestions")}
                >
                  Important Questions
                  <span>{openLeadSections.importantQuestions ? "▲" : "▼"}</span>
                </button>
                {openLeadSections.importantQuestions && (
                  <div className="px-6 pb-5">
                    <ImportantQuestionsSection
                      lead={selectedLead}
                      handleFieldChange={handleSelectedLeadFieldChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For other tabs, render as before
    const activeTabSection = detailSections[activeTab];
    const sectionData = activeTabSection.getContent(
      selectedLead,
      handleSelectedLeadFieldChange
    );
    
    return (
      <div className="min-h-screen bg-black text-white text-[0.2rem]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-6 bg-[#0c1019] border-b-4 border-cyan-400/70 shadow-lg">
          <button
            onClick={handleBackToTable}
            className="text-cyan-300 mr-2 px-2 py-1 text-xl font-bold rounded hover:bg-cyan-900/20 transition"
            aria-label="Back"
          >{"←"}</button>
          <User className="text-cyan-300 w-10 h-8 drop-shadow" />
          <h1 className="text-xl font-extrabold text-cyan-300 tracking-wide drop-shadow">{selectedLead.customerName}</h1>
          <div className="flex-1"></div>
          <div className="flex gap-2">
            <button className="bg-gradient-to-b from-cyan-400 to-blue-700 px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-[1rem]">
              COPY THIS LEAD
            </button>
            <button className="bg-gradient-to-b from-cyan-400 to-blue-700 px-5 py-1.5 rounded-lg text-white font-bold shadow-lg hover:from-blue-700 hover:to-cyan-400 uppercase tracking-wide transition text-[1rem]">
              FILE SENT TO LOGIN
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 px-7 py-3 bg-black border-b border-[#232c3a]">
          {detailSections.map((tab, idx) => (
            <button
              key={tab.label}
              className={`
                flex items-center px-6 py-2 rounded-3xl font-extrabold border shadow-md text-[1.05rem] transition
                ${idx === activeTab
                  ? "bg-[#03B0F5] via-blue-700 to-cyan-500 text-white border-cyan-400 shadow-lg scale-105"
                  : "bg-white text-[#03B0F5] border-[#2D3C56] hover:bg-cyan-400/10 hover:text-cyan-400"
                }
                focus:outline-none
              `}
              style={{
                boxShadow: idx === activeTab ? "0 4px 16px 0 #1cb5e080" : undefined,
                cursor: "pointer",
                letterSpacing: "0.01em"
              }}
              onClick={() => {
                setActiveTab(idx);
                setOpenSection(0);
              }}
            >
              {tab.icon || null}
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Section Content (No Accordion) */}
        <div className="px-2 py-6 max-w-7xl mx-auto">
          <div className={`p-4 shadow-2xl rounded-2xl ${activeTabSection.label === "TASK" ? "bg-black" : "bg-white"}`}>
            {sectionData.map((section, idx) => (
              <div key={section.label || idx} className="mb-6">
                {section.label && (
                  <div className={`px-5 py-2 font-extrabold text-[1.05rem] ${activeTabSection.label === "TASK" ? "text-cyan-400" : "text-[#03B0F5]"}`}>
                    {section.label}
                  </div>
                )}
                <div className={`rounded-xl border-2 border-cyan-400/40 shadow-inner ${activeTabSection.label === "TASK" ? "bg-black" : "bg-white"}`}>
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- TABLE PAGE (unchanged) ---
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-y-scroll max-h-screen">
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative z-10 px-6 py-8 space-y-10">
        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 ">
          {statusCardConfig.map(({ key, label, icon: Icon, gradient }, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl bg-gradient-to-r ${gradient} font-bold shadow-lg`}
              style={{ minHeight: 120, minWidth: 0 }}
            >
              <div className="flex justify-between items-center">
                <Icon className="w-6 h-6 text-white" />
                <span
                  className="font-bold text-white"
                  style={{ fontSize: "38px", lineHeight: 1 }}
                >
                  {statusCounts[key]}
                </span>
              </div>
              <p className="mt-4 text-lg font-extrabold text-white uppercase tracking-wide">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Filter and Search Controls */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            {/* Search Results Indicator */}
            {(searchTerm || getActiveFilterCount() > 0) && (
              <div className="text-sm text-gray-300 bg-[#1b2230] px-3 py-2 rounded-lg border border-gray-600">
                {filteredLeads.length} of {editedLeads.length} leads
                {searchTerm && (
                  <span className="ml-1">
                    matching "<span className="text-cyan-400 font-semibold">{searchTerm}</span>"
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <button
              onClick={() => setShowFilterPopup(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 relative ${
                getActiveFilterCount() > 0
                  ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600'
                  : 'bg-[#1b2230] hover:bg-[#2a3441] text-gray-300 border-gray-600 hover:border-gray-500'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filter
              {getActiveFilterCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>
            
            <div className="relative w-[280px]">
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-10 pr-4 bg-[#1b2230] text-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm placeholder-gray-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="overflow-auto rounded-xl">
          {!checkboxVisible && (
            <div className="flex items-center mb-2">
              <button
                className="bg-[#03B0F5] text-white px-5 py-2 rounded font-bold shadow hover:bg-[#0280b5] transition"
                onClick={handleShowCheckboxes}
              >
                {checkedRows.length > 0
                  ? `Select (${checkedRows.length})`
                  : "Select"}
              </button>
            </div>
          )}
          {checkboxVisible && (
            <div
              className="flex items-center mb-2 gap-6 bg-gray-900 rounded p-2 transition-all duration-300"
              style={{ marginLeft: 0 }}
            >
              <label className="flex items-center cursor-pointer text-[#03B0F5] font-bold">
                <input
                  type="checkbox"
                  className="accent-blue-500 mr-2"
                  checked={allRowsChecked}
                  onChange={handleSelectAll}
                  style={{ width: 18, height: 18 }}
                />
                Select All
              </label>
              <span className="text-white font-semibold">
                {checkedRows.length} row{checkedRows.length !== 1 ? "s" : ""} selected
              </span>
              <button
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition"
                onClick={handleDeleteSelected}
                disabled={checkedRows.length === 0}
              >
                Delete ({checkedRows.length})
              </button>
              <button
                className="ml-2 px-3 py-1 bg-gray-600 text-white rounded font-bold hover:bg-gray-700 transition"
                onClick={handleCancelSelection}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="w-full transition-all duration-300" style={{ marginLeft: 0 }}>
            <table className="min-w-[1700px] w-full ">
              <thead className="bg-white text-[#03b0f5] ">
                <tr>
                  {checkboxVisible && (
                    <th className="py-3 px-4 text-center whitespace-nowrap"></th>
                  )}
                  {columns.map((col, colIdx) => (
                    <th
                      key={col.key}
                      className={`py-3 px-4 text-xl font-extrabold text-[#03b0f5] ${col.className}`}
                    >
                      {col.key === "index" ? "#" : 
                       col.key === "createdBy" ? (
                         <div className="flex items-center justify-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg ">
                             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                             </svg>
                           </div>
                           <span>{col.label}</span>
                         </div>
                       ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + (checkboxVisible ? 1 : 0)} className="text-center py-10">
                      Loading...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (checkboxVisible ? 1 : 0)} className="text-center py-10 text-white">
                      No Leads Found
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, rowIdx) => (
                    <tr
                      key={rowIdx}
                      ref={el => (rowRefs.current[rowIdx] = el)}
                      className={`border-b-2 border-white transition cursor-pointer
                        ${checkedRows.includes(rowIdx)
                          ? "bg-gray-900 ring-2 ring-[#03B0F5] border-b-[#03B0F5]"
                          : "hover:bg-gray-800"
                        }`}
                      style={
                        checkedRows.includes(rowIdx)
                          ? { fontSize: "0.95rem", minHeight: "36px" }
                          : {}
                      }
                      onClick={() => !checkboxVisible && handleRowClick(rowIdx)}
                    >
                      {checkboxVisible && (
                        <td className="py-2 px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="accent-blue-500"
                            checked={checkedRows.includes(rowIdx)}
                            onChange={() => handleCheckboxChange(rowIdx)}
                          />
                        </td>
                      )}
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{rowIdx + 1}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.leadDate || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                            {lead.createdBy ? lead.createdBy.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span>{lead.createdBy || "-"}</span>
                        </div>
                      </td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.campaignName || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.teamName || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {lead.customerName ? lead.customerName.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span>{lead.customerName || "-"}</span>
                        </div>
                      </td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">
                        {checkboxVisible ? (
                          <div className="space-y-2">
                            {/* Primary Status Dropdown */}
                            <select
                              className="w-full bg-gray-700 border-bg-white-900 text-lg font-semibold border-2 border-gray-800 text-white py-1 px-2 rounded-md"
                              value={statusSelections[rowIdx]?.primary || ""}
                              onChange={e => handleStatusPrimaryChange(rowIdx, e.target.value)}
                              onBlur={handleRowBlur}
                              style={{ fontSize: "0.95rem", minHeight: "28px" }}
                            >
                              <option value="">Select Primary...</option>
                              {COLUMN_SELECT_OPTIONS.status.primary.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            
                            {/* Sub Status Dropdown - Only show if "Lead" is selected */}
                            {statusSelections[rowIdx]?.primary === "Lead" && (
                              <select
                                className="w-full bg-gray-600 border-bg-white-900 text-lg font-semibold border-2 border-gray-700 text-white py-1 px-2 rounded-md"
                                value={statusSelections[rowIdx]?.sub || ""}
                                onChange={e => handleStatusSubChange(rowIdx, e.target.value)}
                                onBlur={handleRowBlur}
                                style={{ fontSize: "0.95rem", minHeight: "28px" }}
                              >
                                <option value="">Select Lead Type...</option>
                                {COLUMN_SELECT_OPTIONS.status.leadSubOptions.map(opt => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          lead.status || "-"
                        )}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap text-lg font-semibold">
                        {checkboxVisible ? (
                          <select
                            className="bg-gray-700 text-white py-1 px-2 rounded text-lg font-semibold"
                            value={lead.action || ""}
                            onChange={e => handleSelectChange(rowIdx, "action", e.target.value)}
                            onBlur={handleRowBlur}
                            style={{ fontSize: "0.95rem", minHeight: "28px" }}
                          >
                            <option value="">Select...</option>
                            {COLUMN_SELECT_OPTIONS.action.map(opt => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          lead.action || "-"
                        )}
                      </td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.salary || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.eligibility || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.loanAmountApplied || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.companyCategory || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.pinCode || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.obligation || "-"}</td>
                      <td className="text-lg font-semibold py-2 px-4 whitespace-nowrap">{lead.btPost || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Filter Popup */}
      {showFilterPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1b2230] border border-gray-600 rounded-lg p-6 w-[700px] max-w-[90vw] h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Filter Leads</h2>
              <button
                onClick={() => setShowFilterPopup(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-6 h-[350px]">
              {/* Left side - Filter Categories */}
              <div className="col-span-1 border-r border-gray-600 pr-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Filter Categories</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFilterCategory('leads')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFilterCategory === 'leads'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-[#2a3441]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                        Leads Status
                      </div>
                      {getFilterCategoryCount('leads') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('leads')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('date')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFilterCategory === 'date'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-[#2a3441]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                        </svg>
                        Lead Date
                      </div>
                      {getFilterCategoryCount('date') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('date')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('team')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFilterCategory === 'team'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-[#2a3441]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                        </svg>
                        Team
                      </div>
                      {getFilterCategoryCount('team') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('team')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('createdBy')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFilterCategory === 'createdBy'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-[#2a3441]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                        </svg>
                        Created By
                      </div>
                      {getFilterCategoryCount('createdBy') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('createdBy')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedFilterCategory('other')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedFilterCategory === 'other'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-[#2a3441]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Other Filters
                      </div>
                      {getFilterCategoryCount('other') > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {getFilterCategoryCount('other')}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Right side - Filter Options based on selected category */}
              <div className="col-span-2 pl-4">
                {selectedFilterCategory === 'leads' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Leads Status</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Lead Status
                        </label>
                        <select
                          value={filterOptions.leadStatus}
                          onChange={(e) => setFilterOptions({...filterOptions, leadStatus: e.target.value})}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="Not a Lead">Not a Lead</option>
                          {COLUMN_SELECT_OPTIONS.status.leadSubOptions.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedFilterCategory === 'date' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Lead Date Range</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
                        <input
                          type="date"
                          value={filterOptions.dateFrom}
                          onChange={(e) => setFilterOptions({...filterOptions, dateFrom: e.target.value})}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
                        <input
                          type="date"
                          value={filterOptions.dateTo}
                          onChange={(e) => setFilterOptions({...filterOptions, dateTo: e.target.value})}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedFilterCategory === 'team' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Team Filters</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Select Team
                        </label>
                        <div className="max-h-64 overflow-y-auto border border-gray-600 rounded-lg p-2 bg-[#2a3441]">
                          <div className="space-y-2">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="teamFilter"
                                value=""
                                checked={filterOptions.teamName === ""}
                                onChange={(e) => setFilterOptions({...filterOptions, teamName: e.target.value})}
                                className="mr-2 accent-blue-500"
                              />
                              <span className="text-white">All Teams</span>
                            </label>
                            {getUniqueTeams().map(team => (
                              <label key={team} className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="teamFilter"
                                  value={team}
                                  checked={filterOptions.teamName === team}
                                  onChange={(e) => setFilterOptions({...filterOptions, teamName: e.target.value})}
                                  className="mr-2 accent-blue-500"
                                />
                                <span className="text-white">{team}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedFilterCategory === 'createdBy' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Created By Filters</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Select Creator
                        </label>
                        <div className="max-h-64 overflow-y-auto border border-gray-600 rounded-lg p-2 bg-[#2a3441]">
                          <div className="space-y-2">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="creatorFilter"
                                value=""
                                checked={filterOptions.createdBy === ""}
                                onChange={(e) => setFilterOptions({...filterOptions, createdBy: e.target.value})}
                                className="mr-2 accent-blue-500"
                              />
                              <span className="text-white">All Creators</span>
                            </label>
                            {getUniqueCreators().map(creator => (
                              <label key={creator} className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="creatorFilter"
                                  value={creator}
                                  checked={filterOptions.createdBy === creator}
                                  onChange={(e) => setFilterOptions({...filterOptions, createdBy: e.target.value})}
                                  className="mr-2 accent-blue-500"
                                />
                                <span className="text-white">{creator}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedFilterCategory === 'other' && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Other Filters</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Campaign Name
                        </label>
                        <select
                          value={filterOptions.campaignName}
                          onChange={(e) => setFilterOptions({...filterOptions, campaignName: e.target.value})}
                          className="w-full px-3 py-2 bg-[#2a3441] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">All Campaigns</option>
                          <option value="Online Campaign">Online Campaign</option>
                          <option value="Offline Drive">Offline Drive</option>
                          <option value="Partner Channel">Partner Channel</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setFilterOptions({
                    leadStatus: '',
                    dateFrom: '',
                    dateTo: '',
                    teamName: '',
                    campaignName: '',
                    createdBy: ''
                  })
                }}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-[#2a3441] transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterPopup(false)}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-[#2a3441] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Applying filters:', filterOptions)
                  setShowFilterPopup(false)
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Find
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
