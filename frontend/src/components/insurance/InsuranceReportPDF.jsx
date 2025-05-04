// src/components/insurance/InsuranceReportPDF.jsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register custom fonts
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf', fontStyle: 'italic' }
  ]
});

// Define document styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Roboto'
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1
  },
  headerSection: {
    marginBottom: 20,
    borderBottom: '1pt solid #dddddd',
    paddingBottom: 10
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4361ee',
    marginBottom: 10
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096'
  },
  reportDate: {
    fontSize: 10,
    color: '#718096',
    marginTop: 5
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 10,
    backgroundColor: '#f7fafc',
    padding: 5,
    borderLeft: '4pt solid #4361ee'
  },
  propertySection: {
    marginBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  policySection: {
    marginBottom: 20
  },
  policyInfoItem: {
    flexDirection: 'row',
    marginBottom: 5
  },
  propertyInfoColumn: {
    width: '50%',
    paddingRight: 5
  },
  propertyImageColumn: {
    width: '50%',
    alignItems: 'center'
  },
  propertyImage: {
    width: 250,
    height: 150,
    objectFit: 'cover',
    marginBottom: 5,
    border: '1pt solid #dddddd'
  },
  label: {
    width: 150,
    fontSize: 10,
    color: '#4a5568',
    fontWeight: 'bold'
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: '#1a202c'
  },
  damageSection: {
    marginBottom: 20
  },
  damageTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  },
  damageType: {
    fontSize: 8,
    backgroundColor: '#ebf8ff',
    color: '#2b6cb0',
    padding: '3 6',
    margin: 2,
    borderRadius: 3
  },
  conditionIndicator: {
    padding: '3 8',
    borderRadius: 3,
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  excellent: {
    backgroundColor: '#48bb78'
  },
  good: {
    backgroundColor: '#8bc34a'
  },
  fair: {
    backgroundColor: '#ffca3a'
  },
  poor: {
    backgroundColor: '#ff595e'
  },
  critical: {
    backgroundColor: '#dc3545'
  },
  damageDescription: {
    fontSize: 10,
    marginBottom: 10
  },
  materialsSection: {
    marginBottom: 20
  },
  materialSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  specItem: {
    width: '33%',
    marginBottom: 8
  },
  specLabel: {
    fontSize: 8,
    color: '#718096'
  },
  specValue: {
    fontSize: 10,
    color: '#2d3748'
  },
  costSection: {
    marginBottom: 20
  },
  costTable: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#dddddd',
    marginBottom: 10
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeaderRow: {
    backgroundColor: '#f7fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    borderBottomStyle: 'solid'
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4a5568',
    padding: 5
  },
  tableCell: {
    fontSize: 10,
    padding: 5
  },
  tableCellIssue: {
    width: '60%',
    borderRightWidth: 1,
    borderRightColor: '#dddddd',
    borderRightStyle: 'solid'
  },
  tableCellCost: {
    width: '40%'
  },
  totalRow: {
    backgroundColor: '#ebf8ff'
  },
  recommendationSection: {
    marginBottom: 20
  },
  recommendation: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 5
  },
  recommendationText: {
    fontSize: 10,
    color: '#2d3748'
  },
  certificationSection: {
    marginTop: 20,
    borderTop: '1pt solid #dddddd',
    paddingTop: 10
  },
  disclaimer: {
    fontSize: 8,
    color: '#718096',
    fontStyle: 'italic',
    marginBottom: 5
  },
  signature: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 10
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#718096'
  }
});

// Format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(parseFloat(amount))) return 'Unknown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(parseFloat(amount));
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Return safe value with fallback
const safeValue = (value, fallback = 'Unknown') => {
  return value !== undefined && value !== null ? value : fallback;
};

const InsuranceReportPDF = ({ data }) => {
  const {
    policyholderInfo,
    propertyInfo,
    damageAssessment,
    materialSpecs,
    costEstimates,
    generatedDate,
    imageData
  } = data;
  
  // Get damage types as an array
  const damageTypes = Array.isArray(damageAssessment?.damageTypes) 
    ? damageAssessment.damageTypes 
    : (damageAssessment?.damageTypes ? [damageAssessment.damageTypes] : []);
  
  // Get style for condition indicator
  const getConditionStyle = (condition) => {
    if (!condition) return styles.fair;
    
    switch(condition.toLowerCase()) {
      case 'excellent': return [styles.conditionIndicator, styles.excellent];
      case 'good': return [styles.conditionIndicator, styles.good];
      case 'fair': return [styles.conditionIndicator, styles.fair];
      case 'poor': return [styles.conditionIndicator, styles.poor];
      case 'critical': return [styles.conditionIndicator, styles.critical];
      default: return [styles.conditionIndicator, styles.fair];
    }
  };
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Roof Damage Assessment Report</Text>
          <Text style={styles.headerSubtitle}>Professional Analysis for Insurance Claim</Text>
          <Text style={styles.reportDate}>Generated on: {formatDate(generatedDate)}</Text>
        </View>
        
        {/* Policyholder Information */}
        <View style={styles.policySection}>
          <Text style={styles.sectionTitle}>Policyholder Information</Text>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Policyholder Name:</Text>
            <Text style={styles.value}>{safeValue(policyholderInfo?.name)}</Text>
          </View>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Insurance Company:</Text>
            <Text style={styles.value}>{safeValue(policyholderInfo?.insuranceCompany)}</Text>
          </View>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Policy Number:</Text>
            <Text style={styles.value}>{safeValue(policyholderInfo?.policyNumber)}</Text>
          </View>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Claim Number:</Text>
            <Text style={styles.value}>{safeValue(policyholderInfo?.claimNumber)}</Text>
          </View>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Date of Damage:</Text>
            <Text style={styles.value}>{formatDate(policyholderInfo?.dateOfDamage)}</Text>
          </View>
          
          <View style={styles.policyInfoItem}>
            <Text style={styles.label}>Contact Information:</Text>
            <Text style={styles.value}>
              {safeValue(policyholderInfo?.contactPhone)}
              {policyholderInfo?.contactEmail ? ` • ${policyholderInfo.contactEmail}` : ''}
            </Text>
          </View>
        </View>
        
        {/* Property Information */}
        <View style={styles.propertySection}>
          <Text style={styles.sectionTitle}>Property Information</Text>
          
          <View style={styles.propertyInfoColumn}>
            <View style={styles.policyInfoItem}>
              <Text style={styles.label}>Property Address:</Text>
              <Text style={styles.value}>{safeValue(policyholderInfo?.address)}</Text>
            </View>
            
            {propertyInfo && (
              <>
                <View style={styles.policyInfoItem}>
                  <Text style={styles.label}>Property Type:</Text>
                  <Text style={styles.value}>{safeValue(propertyInfo?.details?.propertyType)}</Text>
                </View>
                
                <View style={styles.policyInfoItem}>
                  <Text style={styles.label}>Year Built:</Text>
                  <Text style={styles.value}>{safeValue(propertyInfo?.details?.yearBuilt)}</Text>
                </View>
                
                <View style={styles.policyInfoItem}>
                  <Text style={styles.label}>Square Footage:</Text>
                  <Text style={styles.value}>
                    {propertyInfo?.details?.squareFootage 
                      ? `${propertyInfo.details.squareFootage.toLocaleString()} sq ft` 
                      : 'Unknown'
                    }
                  </Text>
                </View>
                
                <View style={styles.policyInfoItem}>
                  <Text style={styles.label}>Estimated Value:</Text>
                  <Text style={styles.value}>
                    {propertyInfo?.valuation?.estimatedValue 
                      ? formatCurrency(propertyInfo.valuation.estimatedValue) 
                      : 'Unknown'
                    }
                  </Text>
                </View>
              </>
            )}
          </View>
          
          <View style={styles.propertyImageColumn}>
            {imageData && (
              <Image 
                src={`data:image/jpeg;base64,${imageData}`} 
                style={styles.propertyImage} 
              />
            )}
            <Text style={{ fontSize: 8, color: '#718096' }}>Property Roof Image</Text>
          </View>
        </View>
        
        {/* Damage Assessment */}
        <View style={styles.damageSection}>
          <Text style={styles.sectionTitle}>Damage Assessment</Text>
          
          {damageAssessment?.overallCondition && (
            <View style={getConditionStyle(damageAssessment.overallCondition)}>
              <Text>Condition: {damageAssessment.overallCondition}</Text>
            </View>
          )}
          
          {damageTypes.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5 }}>
                Detected Damage Types:
              </Text>
              <View style={styles.damageTypeContainer}>
                {damageTypes.map((type, index) => (
                  <Text key={index} style={styles.damageType}>{type}</Text>
                ))}
              </View>
            </>
          )}
          
          {damageAssessment?.description && (
            <Text style={styles.damageDescription}>{damageAssessment.description}</Text>
          )}
          
          {damageAssessment?.likelyDamageCauses && (
            <View style={styles.policyInfoItem}>
              <Text style={styles.label}>Likely Causes:</Text>
              <Text style={styles.value}>
                {Array.isArray(damageAssessment.likelyDamageCauses) 
                  ? damageAssessment.likelyDamageCauses.join(', ')
                  : damageAssessment.likelyDamageCauses
                }
              </Text>
            </View>
          )}
          
          {damageAssessment?.damageSeverity && (
            <View style={styles.policyInfoItem}>
              <Text style={styles.label}>Damage Severity:</Text>
              <Text style={styles.value}>{damageAssessment.damageSeverity}/10</Text>
            </View>
          )}
        </View>
        
        {/* Material Specifications */}
        <View style={styles.materialsSection}>
          <Text style={styles.sectionTitle}>Material Specifications</Text>
          
          <View style={styles.materialSpecsGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Material Type</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.material)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Manufacturer</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.manufacturer)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Product Line</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.productLine)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Estimated Age</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.estimatedAge)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Expected Lifespan</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.lifespan)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Dimensions</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.dimensions)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Thickness</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.thickness)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Warranty</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.warranty)}</Text>
            </View>
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Material Weight</Text>
              <Text style={styles.specValue}>{safeValue(materialSpecs?.weight)}</Text>
            </View>
          </View>
        </View>
        
        {/* Cost Estimation */}
        <View style={styles.costSection}>
          <Text style={styles.sectionTitle}>Cost Estimation</Text>
          
          <View style={styles.costTable}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableHeaderCell, styles.tableCellIssue]}>Damage Type</Text>
              <Text style={[styles.tableHeaderCell, styles.tableCellCost]}>Estimated Cost</Text>
            </View>
            
            {costEstimates?.details?.map((detail, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableCellIssue]}>{detail.type}</Text>
                <Text style={[styles.tableCell, styles.tableCellCost]}>
                  {formatCurrency(detail.min)} - {formatCurrency(detail.max)}
                </Text>
              </View>
            ))}
            
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, styles.tableCellIssue, { fontWeight: 'bold' }]}>
                Total Repair Cost
              </Text>
              <Text style={[styles.tableCell, styles.tableCellCost, { fontWeight: 'bold' }]}>
                {formatCurrency(costEstimates?.repair)}
              </Text>
            </View>
            
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCell, styles.tableCellIssue, { fontWeight: 'bold' }]}>
                Total Replacement Cost
              </Text>
              <Text style={[styles.tableCell, styles.tableCellCost, { fontWeight: 'bold' }]}>
                {formatCurrency(costEstimates?.replacement)}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          
          <Text style={styles.recommendation}>
            Recommended Action: {safeValue(damageAssessment?.recommendedAction)}
          </Text>
          
          {damageAssessment?.recommendedAction && (
            <Text style={styles.recommendationText}>
              {damageAssessment.recommendedAction}
            </Text>
          )}
        </View>
        
        {/* Certification */}
        <View style={styles.certificationSection}>
          <Text style={styles.disclaimer}>
            Disclaimer: This report is generated based on AI-powered visual analysis of the provided roof images.
            While our system uses advanced technology to assess damage and estimate costs, we recommend verification
            by a licensed roofing professional before making final repair decisions. Cost estimates are based on
            national averages and may vary by region, contractor, and specific circumstances.
          </Text>
          
          <Text style={styles.disclaimer}>
            This report was automatically generated on {formatDate(generatedDate)} by the Roof Analyzer
            application using artificial intelligence visual assessment technology.
          </Text>
        </View>
        
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} />
      </Page>
    </Document>
  );
};

export default InsuranceReportPDF;
