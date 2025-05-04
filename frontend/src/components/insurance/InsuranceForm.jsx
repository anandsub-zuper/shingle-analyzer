// src/components/insurance/InsuranceForm.jsx
import React from 'react';
import '../../styles/InsuranceForm.css';

const InsuranceForm = ({ policyholderInfo, propertyInfo, onChange, onSubmit }) => {
  return (
    <form className="insurance-form" onSubmit={onSubmit}>
      <div className="form-section">
        <h3 className="form-section-title">Policyholder Information</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={policyholderInfo.name}
              onChange={onChange}
              required
              placeholder="Enter full name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="contactPhone">Phone Number</label>
            <input
              type="tel"
              id="contactPhone"
              name="contactPhone"
              value={policyholderInfo.contactPhone}
              onChange={onChange}
              placeholder="(123) 456-7890"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="contactEmail">Email Address</label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              value={policyholderInfo.contactEmail}
              onChange={onChange}
              placeholder="email@example.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="dateOfDamage">Date of Damage</label>
            <input
              type="date"
              id="dateOfDamage"
              name="dateOfDamage"
              value={policyholderInfo.dateOfDamage}
              onChange={onChange}
              required
            />
          </div>
        </div>
      </div>
      
      <div className="form-section">
        <h3 className="form-section-title">Insurance Information</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="insuranceCompany">Insurance Company</label>
            <input
              type="text"
              id="insuranceCompany"
              name="insuranceCompany"
              value={policyholderInfo.insuranceCompany}
              onChange={onChange}
              placeholder="Insurance company name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="policyNumber">Policy Number</label>
            <input
              type="text"
              id="policyNumber"
              name="policyNumber"
              value={policyholderInfo.policyNumber}
              onChange={onChange}
              placeholder="Policy number"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="claimNumber">Claim Number (if available)</label>
            <input
              type="text"
              id="claimNumber"
              name="claimNumber"
              value={policyholderInfo.claimNumber}
              onChange={onChange}
              placeholder="Claim number (if already filed)"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="adjusterName">Adjuster Name (if assigned)</label>
            <input
              type="text"
              id="adjusterName"
              name="adjusterName"
              value={policyholderInfo.adjusterName}
              onChange={onChange}
              placeholder="Insurance adjuster name (if known)"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="adjusterPhone">Adjuster Phone (if available)</label>
            <input
              type="tel"
              id="adjusterPhone"
              name="adjusterPhone"
              value={policyholderInfo.adjusterPhone}
              onChange={onChange}
              placeholder="Adjuster phone number (if known)"
            />
          </div>
        </div>
      </div>
      
      <div className="form-section">
        <h3 className="form-section-title">Property Information</h3>
        
        <div className="form-row">
          <div className="form-group form-group-full">
            <label htmlFor="address">Property Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={policyholderInfo.address}
              onChange={onChange}
              required
              placeholder="Full property address"
            />
          </div>
        </div>
        
        {propertyInfo && (
          <div className="detected-property-info">
            <h4>Auto-Detected Property Information</h4>
            <div className="property-info-grid">
              <div className="property-info-item">
                <span className="property-info-label">Property Type:</span>
                <span className="property-info-value">{propertyInfo.details?.propertyType || 'Unknown'}</span>
              </div>
              
              <div className="property-info-item">
                <span className="property-info-label">Year Built:</span>
                <span className="property-info-value">{propertyInfo.details?.yearBuilt || 'Unknown'}</span>
              </div>
              
              <div className="property-info-item">
                <span className="property-info-label">Square Footage:</span>
                <span className="property-info-value">
                  {propertyInfo.details?.squareFootage 
                    ? `${propertyInfo.details.squareFootage.toLocaleString()} sq ft` 
                    : 'Unknown'
                  }
                </span>
              </div>
              
              <div className="property-info-item">
                <span className="property-info-label">Bedrooms:</span>
                <span className="property-info-value">{propertyInfo.details?.bedrooms || 'Unknown'}</span>
              </div>
              
              <div className="property-info-item">
                <span className="property-info-label">Bathrooms:</span>
                <span className="property-info-value">{propertyInfo.details?.bathrooms || 'Unknown'}</span>
              </div>
              
              <div className="property-info-item">
                <span className="property-info-label">Lot Size:</span>
                <span className="property-info-value">
                  {propertyInfo.details?.lotSize 
                    ? `${propertyInfo.details.lotSize.toLocaleString()} sq ft` 
                    : 'Unknown'
                  }
                </span>
              </div>
              
              {propertyInfo.valuation?.estimatedValue && (
                <div className="property-info-item">
                  <span className="property-info-label">Estimated Value:</span>
                  <span className="property-info-value">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0
                    }).format(propertyInfo.valuation.estimatedValue)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="form-actions">
        <button type="submit" className="submit-button">Generate Report</button>
      </div>
    </form>
  );
};

export default InsuranceForm;
