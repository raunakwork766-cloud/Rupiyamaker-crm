import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';

// Lazy load all heavy sections to improve initial load time
// Using React.lazy with error boundaries and retry mechanisms
const createLazyComponent = (importFn, componentName) => {
    return lazy(() => 
        importFn().catch((error) => {
            console.error(`Failed to load ${componentName}:`, error);
            // Retry mechanism - try loading again after a short delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(importFn());
                }, 1000);
            });
        })
    );
};

const AboutSection = createLazyComponent(() => import('./sections/AboutSection'), 'AboutSection');
const HowToProcessSection = createLazyComponent(() => import('./sections/HowToProcessSection'), 'HowToProcessSection');
const ImportantQuestionsSection = createLazyComponent(() => import('./sections/ImportantQuestionsSection'), 'ImportantQuestionsSection');
const LoginFormSection = createLazyComponent(() => import('./sections/LoginFormSection'), 'LoginFormSection');
const ObligationSection = createLazyComponent(() => import('./sections/ObligationSection'), 'ObligationSection');
const Attachments = createLazyComponent(() => import('./sections/Attachments'), 'Attachments');
const TaskComponent = createLazyComponent(() => import('./sections/TaskSectionInLead'), 'TaskComponent');
const LeadActivity = createLazyComponent(() => import('./LeadActivity'), 'LeadActivity');
const CopyLeadSection = createLazyComponent(() => import('./sections/CopyLeadSection'), 'CopyLeadSection');
const RemarkSection = createLazyComponent(() => import('./Remark'), 'RemarkSection');
const FileSentToLoginSection = createLazyComponent(() => import('./sections/FileSentToLoginSection'), 'FileSentToLoginSection');
const ReassignmentPanel = createLazyComponent(() => import('./sections/ReassignmentPanel'), 'ReassignmentPanel');
const RequestReassignmentButton = createLazyComponent(() => import('./sections/RequestReassignmentButton'), 'RequestReassignmentButton');
const LeadDetails = createLazyComponent(() => import('./LeadDetails'), 'LeadDetails');

// Enhanced loading fallback component with error boundary
const SectionLoader = ({ height = '200px', error = null, retry = null }) => {
    if (error) {
        return (
            <div style={{ 
                height, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                background: '#fff2f0',
                borderRadius: '8px',
                border: '1px solid #ffccc7',
                padding: '16px'
            }}>
                <div style={{ color: '#ff4d4f', marginBottom: '8px' }}>
                    Failed to load section
                </div>
                {retry && (
                    <button 
                        onClick={retry}
                        style={{
                            background: '#1890ff',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{ 
            height, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#fafafa',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
        }}>
            <Spin size="large" tip="Loading section..." />
        </div>
    );
};

// Enhanced wrapper component for lazy sections with error boundary
class LazySection extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, retryCount: 0 };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('LazySection error:', error, errorInfo);
    }

    retry = () => {
        this.setState({ 
            hasError: false, 
            retryCount: this.state.retryCount + 1 
        });
    }

    render() {
        if (this.state.hasError) {
            return <SectionLoader height={this.props.height} error={true} retry={this.retry} />;
        }

        return (
            <Suspense 
                fallback={<SectionLoader height={this.props.height} />}
                key={this.state.retryCount} // Force remount on retry
            >
                {this.props.children}
            </Suspense>
        );
    }
}

export {
    AboutSection,
    HowToProcessSection,
    ImportantQuestionsSection,
    LoginFormSection,
    ObligationSection,
    Attachments,
    TaskComponent,
    LeadActivity,
    CopyLeadSection,
    RemarkSection,
    FileSentToLoginSection,
    ReassignmentPanel,
    RequestReassignmentButton,
    LeadDetails,
    LazySection
};
