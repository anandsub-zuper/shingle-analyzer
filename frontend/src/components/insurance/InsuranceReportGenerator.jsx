// src/components/insurance/InsuranceReportGenerator.jsx
import React, { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { detectUserLocation, getAddressFromCoordinates } from '../../utils/locationUtils';
import { fetchPropertyInfo } from '../../utils/propertyUtils';
import InsuranceForm from './InsuranceForm';
import ReportPreview from './ReportPreview';
import InsuranceReportPDF from './InsuranceReportPDF';
import { sendReportEmail } from '../../utils/emailUtils';
import '../../styles/InsuranceReportGenerator.css';

const InsuranceReportGenerator = ({ 
  analysisResults, 
  damageAssessment, 
  materialSpecs, 
  costEstimates,
  uploadedImage
}) => {
  // States
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [propertyError, setPropertyError] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);
  
  // Property and report data states
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  
  // Policy holder information
  const [policyholderInfo, setPolicyholderInfo] = useState({
    name: '',
    policyNumber: '',
    address: '',
    claimNumber: '',
    dateOfDamage: new Date().toISOString().split('T')[0], // Default to today
    contactPhone: '',
    contactEmail: '',
    insuranceCompany: '',
    adjusterName: '',
    adjusterPhone: ''
  });
  
  // Automatically detect location on component mount
  useEffect(() => {
    detectLocation();
  }, []);
  
  // Detect user location
  const detectLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    
    try {
      const coords = await detectUserLocation();
      const addressInfo = await getAddressFromCoordinates(coords.latitude, coords.longitude);
      
      // Update policyholder address with detected location
      setPolicyholderInfo(prev => ({
        ...prev,
        address: addressInfo.fullAddress
      }));
      
      // Fetch property information based on detected address
      fetchPropertyInformation(addressInfo.fullAddress);
      
    } catch (error) {
      console.error("Error detecting location:", error);
      setLocationError(error.message);
    } finally {
      setIsLoadingLocation(false);
    }
  };
  
  // Fetch property details from RentCast API
  const fetchPropertyInformation = async (address) => {
    if (!address) return;
    
    setIsLoadingProperty(true);
    setPropertyError(null);
    
    try {
      const apiKey = process.env.REACT_APP_RENTCAST_API_KEY;
      const propertyData = await fetchPropertyInfo(address, apiKey);
      setPropertyInfo(propertyData);
      
    } catch (error) {
      console.error("Error fetching property information:", error);
      setPropertyError(error.message);
    } finally {
      setIsLoadingProperty(false);
    }
  };
  
  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setPolicyholderInfo(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle email input change
  const handleEmailChange = (e) => {
    setEmailAddress(e.target.value);
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowPreview(true);
  };
  
  // Handle email sending
  const handleSendEmail = async (pdfBlob) => {
    if (!emailAddress) {
      setEmailError("Please enter an email address");
      return;
    }
    
    setSendingEmail(true);
    setEmailError(null);
    
    try {
      await sendReportEmail({
        to: emailAddress,
        subject: `Roof Damage Report - Claim #${policyholderInfo.claimNumber || 'New'}`,
        text: `Please find attached the roof damage assessment report for ${policyholderInfo.address}`,
        attachments: [
          {
            filename: `Roof_Damage_Report_${policyholderInfo.claimNumber || 'New'}.pdf`,
            content: pdfBlob
          }
        ]
      });
      
      setEmailSent(true);
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailError(error.message);
    } finally {
      setSendingEmail(false);
    }
  };
  
  // Create combined report data
  const reportData = {
    policyholderInfo,
    propertyInfo,
    damageAssessment,
    materialSpecs,
    costEstimates,
    generatedDate: new Date().toISOString(),
    imageData: uploadedImage, // Original uploaded image
    imageUrl: null // Will be set when PDF is generated
  };
  
  // Render loading state during location/property fetch
  if (isLoadingLocation || isLoadingProperty) {
    return (
      <div className="insurance-report-loading">
        <div className="loading-spinner"></div>
        <p>{isLoadingLocation ? "Detecting your location..." : "Fetching property details..."}</p>
      </div>
    );
  }
  
  return (
    <div className="insurance-report-container">
      <h2 className="report-title">Insurance Claim Report Generator</h2>
      
      {/* Display any errors */}
      {(locationError || propertyError) && (
        <div className="error-message">
          {locationError && (
            <p>
              <strong>Location Detection Error:</strong> {locationError}
              <button onClick={detectLocation} className="retry-button">Retry</button>
            </p>
          )}
          {propertyError && (
            <p>
              <strong>Property Information Error:</strong> {propertyError}
              <button 
                onClick={() => fetchPropertyInformation(policyholderInfo.address)} 
                className="retry-button"
              >
                Retry
              </button>
            </p>
          )}
        </div>
      )}
      
      {!showPreview ? (
        /* Display form for collecting policyholder information */
        <InsuranceForm 
          policyholderInfo={policyholderInfo}
          propertyInfo={propertyInfo}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
        />
      ) : (
        /* Display report preview and actions */
        <div className="report-preview-section">
          <ReportPreview data={reportData} />
          
          <div className="report-actions">
            <button 
              className="back-button"
              onClick={() => setShowPreview(false)}
            >
              Edit Information
            </button>
            
            <PDFDownloadLink 
              document={<InsuranceReportPDF data={reportData} />} 
              fileName={`Roof_Damage_Report_${policyholderInfo.claimNumber || 'New'}.pdf`}
              className="download-button"
            >
              {({ loading, blob }) => {
                if (blob) {
                  reportData.pdfBlob = blob;
                }
                return loading ? 'Generating PDF...' : 'Download Report';
              }}
            </PDFDownloadLink>
            
            <button className="print-button" onClick={() => window.print()}>
              Print Report
            </button>
            
            {/* Email sending section */}
            <div className="email-section">
              <h3>Email Report</h3>
              <div className="email-input-container">
                <input
                  type="email"
                  value={emailAddress}
                  onChange={handleEmailChange}
                  placeholder="Enter email address"
                  className="email-input"
                />
                <button 
                  className="send-email-button"
                  onClick={() => handleSendEmail(reportData.pdfBlob)}
                  disabled={sendingEmail || !reportData.pdfBlob}
                >
                  {sendingEmail ? 'Sending...' : 'Send Report'}
                </button>
              </div>
              
              {emailError && (
                <p className="email-error">{emailError}</p>
              )}
              
              {emailSent && (
                <p className="email-success">Report sent successfully!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsuranceReportGenerator;
