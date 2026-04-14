// Comprehensive project descriptions with intent and purpose

export const PROJECT_DESCRIPTIONS: Record<string, {
  overview: string;
  intent: string;
  purpose: string;
  keyFeatures: string[];
  impact: string;
}> = {
  EGOV: {
    overview: "The eGovPH Mobile Application is a comprehensive one-stop-shop platform that brings National and Local Government services directly to Filipino citizens through their mobile devices.",
    intent: "To bridge the digital divide and make government services more accessible, efficient, and transparent by leveraging mobile technology to reach citizens wherever they are.",
    purpose: "Empower citizens with convenient access to government services, reduce bureaucratic red tape, eliminate the need for multiple office visits, and promote digital transformation across all levels of government.",
    keyFeatures: [
      "Single sign-on access to multiple government services",
      "Real-time application tracking and status updates",
      "Digital document submission and verification",
      "Integration with national and local government databases",
      "Secure authentication using government-issued IDs"
    ],
    impact: "Reduces transaction time by up to 70%, eliminates physical queuing, and provides 24/7 access to government services for millions of Filipinos."
  },
  ELGU: {
    overview: "The eLGU (Electronic Local Government Unit) System is a comprehensive digital transformation platform designed to modernize local government operations and service delivery.",
    intent: "To equip Local Government Units with modern ICT infrastructure and systems that enable efficient governance, transparent operations, and improved constituent services.",
    purpose: "Transform traditional paper-based LGU processes into streamlined digital workflows, enhance data-driven decision making, and establish a foundation for smart city initiatives across Bicol Region.",
    keyFeatures: [
      "Integrated LGU management systems (permits, licenses, records)",
      "Digital payment gateways for local taxes and fees",
      "Citizen relationship management platform",
      "Real-time reporting and analytics dashboards",
      "Mobile-responsive citizen portal"
    ],
    impact: "Modernizes 123 LGUs across Bicol Region, improves service delivery efficiency by 60%, and establishes transparent, accountable local governance."
  },
  WIFI: {
    overview: "Free WiFi for All is a nationwide initiative to provide free, reliable, high-speed internet access in public spaces, bridging the digital divide and promoting digital inclusion.",
    intent: "To democratize internet access by providing free WiFi in schools, hospitals, libraries, public transport terminals, and community centers, ensuring no Filipino is left behind in the digital age.",
    purpose: "Enable digital literacy, support online education, facilitate telemedicine, promote e-commerce, and provide citizens with essential connectivity for accessing government services and economic opportunities.",
    keyFeatures: [
      "High-speed WiFi hotspots in strategic public locations",
      "Bandwidth management and fair usage policies",
      "Secure, filtered internet access for public safety",
      "Integration with government portals and services",
      "24/7 technical support and monitoring"
    ],
    impact: "Provides free internet access to over 2 million Bicolanos annually, supports 500+ schools, and enables digital transformation in underserved communities."
  },
  GOVNET: {
    overview: "GovNet (Government Network) is a secure, dedicated fiber-optic network infrastructure connecting all government offices, enabling fast, reliable, and secure inter-agency communication and data exchange.",
    intent: "To establish a robust, secure backbone infrastructure that connects all government agencies, facilitating seamless information sharing, collaborative governance, and enhanced cybersecurity.",
    purpose: "Create a unified government network that eliminates data silos, enables real-time inter-agency coordination, supports disaster response, and provides a secure foundation for all government digital services.",
    keyFeatures: [
      "Dedicated fiber-optic network for government use",
      "High-speed, low-latency connectivity between agencies",
      "Advanced cybersecurity and encryption protocols",
      "Redundant connections for disaster resilience",
      "Centralized network monitoring and management"
    ],
    impact: "Connects 200+ government offices across Bicol, enables real-time data sharing, reduces communication costs by 80%, and strengthens cybersecurity posture."
  },
  CYBER: {
    overview: "The Cybersecurity Program is a comprehensive initiative to protect government ICT infrastructure, data, and services from cyber threats while building cybersecurity awareness and capacity across all agencies.",
    intent: "To safeguard critical government information systems, protect citizen data, and build a culture of cybersecurity awareness that makes the Philippines resilient against evolving cyber threats.",
    purpose: "Implement robust cybersecurity frameworks, conduct regular security audits, provide incident response capabilities, train government personnel, and ensure compliance with national cybersecurity standards.",
    keyFeatures: [
      "24/7 Security Operations Center (SOC) monitoring",
      "Regular vulnerability assessments and penetration testing",
      "Incident response and disaster recovery planning",
      "Cybersecurity awareness training programs",
      "Compliance with ISO 27001 and PH cybersecurity frameworks"
    ],
    impact: "Protects 500+ government systems, trains 1,000+ personnel annually, prevents data breaches, and ensures business continuity for critical government services."
  },
  ILCDB: {
    overview: "The Integrated Local Content Database (iLCDB) is a centralized repository of local government data, content, and knowledge resources that supports evidence-based policymaking and transparent governance.",
    intent: "To create a single source of truth for local government data, enabling data-driven decision making, facilitating research, and promoting transparency through open data initiatives.",
    purpose: "Aggregate, standardize, and make accessible all local government data including demographics, budgets, projects, and services to support planning, monitoring, and citizen engagement.",
    keyFeatures: [
      "Centralized database of LGU data and statistics",
      "Open data portal for public access",
      "Data visualization and analytics tools",
      "API access for third-party applications",
      "Regular data updates and quality assurance"
    ],
    impact: "Consolidates data from 123 LGUs, supports 200+ research projects annually, and enables transparent, evidence-based governance across Bicol Region."
  },
  IIDB: {
    overview: "The Integrated ICT Infrastructure Database (IIDB) is a comprehensive inventory and management system for all government ICT assets, infrastructure, and resources across the region.",
    intent: "To maintain accurate, up-to-date records of all government ICT infrastructure, enabling better resource planning, maintenance scheduling, and strategic investment decisions.",
    purpose: "Track and manage government ICT assets, monitor infrastructure health, optimize resource allocation, plan capacity upgrades, and ensure efficient utilization of technology investments.",
    keyFeatures: [
      "Complete inventory of ICT hardware and software",
      "Asset lifecycle management and tracking",
      "Infrastructure health monitoring dashboards",
      "Maintenance scheduling and ticketing system",
      "Capacity planning and forecasting tools"
    ],
    impact: "Manages 5,000+ ICT assets worth ₱500M+, reduces equipment downtime by 40%, and optimizes ICT investment planning across the region."
  },
  PNPKI: {
    overview: "The Philippine National Public Key Infrastructure (PNPKI) Program establishes a trusted digital identity and authentication framework for secure government transactions and services.",
    intent: "To provide secure, legally-recognized digital signatures and authentication mechanisms that enable trusted electronic transactions between government, businesses, and citizens.",
    purpose: "Implement PKI infrastructure, issue digital certificates, enable secure e-governance transactions, support paperless workflows, and ensure legal validity of electronic documents.",
    keyFeatures: [
      "Digital certificate issuance and management",
      "Secure authentication for government systems",
      "Digital signature capabilities for documents",
      "Integration with eGovPH and other platforms",
      "Compliance with Electronic Commerce Act"
    ],
    impact: "Issues 10,000+ digital certificates, enables legally-binding electronic transactions, reduces paper usage by 60%, and accelerates government processes."
  },
  DRRM: {
    overview: "The Disaster Risk Reduction and Management (DRRM) ICT Program leverages technology to enhance disaster preparedness, early warning systems, emergency response, and post-disaster recovery.",
    intent: "To harness ICT for saving lives and protecting communities by providing real-time disaster information, coordinating emergency response, and supporting resilient recovery.",
    purpose: "Deploy early warning systems, establish emergency communication networks, provide disaster information platforms, coordinate multi-agency response, and support data-driven disaster risk reduction.",
    keyFeatures: [
      "Real-time weather and disaster monitoring systems",
      "SMS and mobile app-based early warning alerts",
      "Emergency communication infrastructure",
      "Disaster response coordination platforms",
      "GIS-based hazard mapping and risk assessment"
    ],
    impact: "Protects 6 million Bicolanos, sends 500,000+ early warning messages annually, coordinates emergency response across 123 LGUs, and supports climate-resilient development."
  },
  NBP: {
    overview: "The National Broadband Program (NBP) aims to provide high-speed internet connectivity to all government offices, schools, and health facilities, creating a digital backbone for inclusive development.",
    intent: "To ensure universal broadband access across the Philippines, particularly in underserved and remote areas, enabling equal opportunities for education, healthcare, and economic participation.",
    purpose: "Deploy broadband infrastructure to unconnected areas, upgrade existing connections, provide affordable internet access, support online education and telemedicine, and drive digital economic growth.",
    keyFeatures: [
      "Fiber-optic and wireless broadband deployment",
      "Last-mile connectivity solutions for remote areas",
      "Subsidized internet access for priority sectors",
      "Network monitoring and quality assurance",
      "Public-private partnership models"
    ],
    impact: "Connects 500+ schools and health facilities, provides broadband to 200+ barangays, enables online learning for 100,000+ students, and supports digital entrepreneurship."
  }
};
