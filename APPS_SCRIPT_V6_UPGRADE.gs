// ================================================================
//  DICT Region V — Program Management System  v5
//  Per-Program Field Schema · Smart Entry Dialog · Image Viewer
//
//  What's new vs v4:
//    • Each program has its own extra field columns (types.ts schema)
//    • "Add Activity" dialog is PROGRAM-AWARE (shows right fields)
//    • Image Viewer sidebar — see Drive images without leaving Sheets
//    • Image thumbnails embedded via SPARKLINE / IMAGE formula
//    • All per-program metrics tracked separately in Dashboard
// ================================================================

// ── WEBHOOK ──────────────────────────────────────────────────────
var WEBHOOK = {
  URL:      'http://127.0.0.1:3210/api/sheets-sync',
  SECRET:   'UsGoSemX8JAtXdgzat05cInmZOYXbEv3',
  SHEET_ID: '1Y795p_gYzoLz-oOjf4ZGD_SgJEzXJhvFfiU_iJkUqUw'
};

// ── CORE COLUMN MAP (shared, 1-indexed) ──────────────────────────
var C = {
  PROVINCE:1,LGU:2,BARANGAY:3,YEAR:4,MONTH:5,ACTIVITY:6,
  VENUE:7,PARTNERS:8,START_DATE:9,END_DATE:10,MODE:11,
  PERSONNEL:12,NGA_M:13,NGA_F:14,LGU_M:15,LGU_F:16,
  SUC_M:17,SUC_F:18,OTH_M:19,OTH_F:20,OTH_LABEL:21,
  AAR:22,FB_LINK:23,PHOTOS_LINK:24,TESTI_LINK:25,
  REMARKS:26,STATUS:27,DRIVE_LINK:28,TOTAL_PAX:29,
  LAST_UPDATED:30,IMAGE_URLS:31
  // Extra program fields start at col 32
};

var BASE_HEADERS = [
  'Province','LGU','Barangay','Year','Month','Activity Title','Venue',
  'Partner Organizations','Start Date','End Date','Mode of Conduct',
  'Personnel','NGA Male','NGA Female','LGU Male','LGU Female',
  'SUC Male','SUC Female','Others Male','Others Female','Others Label',
  'After Activity Report','FB Posting Link','Raw Photos Link',
  'Testimonials Link','Remarks','Status','Drive Folder Link',
  'Total Participants','Last Updated','Image URLs'
];

// ── PER-PROGRAM FIELD SCHEMAS (from types.ts) ─────────────────────
// extraFields: [{key, label, type, options?, group?}]
// These become additional columns starting at col 32 on each sheet.
var PROGRAM_SCHEMA = {

  'eGovPH': {
    code:'EGOV', color:'#1a56db', icon:'📱',
    targetSectors:['All Sector','NGA','LGU','SUC','Private','Communities'],
    modes:['Face-to-Face','Online','Hybrid','On-Site'],
    extraFields:[
      {key:'program',       label:'Program',                         type:'text'},
      {key:'promoCaravan',  label:'Promotional Activity / Caravan',  type:'select', options:['Yes','No']},
      {key:'mentorship',    label:'Conducted Mentorship',            type:'select', options:['Yes','No']},
      {key:'egovDownloads', label:'App Downloads (Cumulative)',       type:'number'}
    ]
  },

  'eLGU': {
    code:'ELGU', color:'#0e9f6e', icon:'🏛',
    targetSectors:['Local Government Units'],
    modes:['On-Site','Face-to-Face','Online'],
    extraFields:[
      {key:'operationalSystems', label:'No. of Operational eLGU Systems', type:'number'},
      {key:'trainingCount',      label:'No. of Trainings / Orientations', type:'number'},
      {key:'techAssistance',     label:'No. of Technical Assistance',     type:'number'},
      {key:'systemName',         label:'System Name / Module',            type:'text'}
    ]
  },

  'Free WiFi': {
    code:'WIFI', color:'#7e3af2', icon:'📶',
    targetSectors:['LGU/Municipalities','Brgy/LGUs','NGA','SUC','Elementary and Secondary Schools'],
    modes:['On-Site','Face-to-Face'],
    extraFields:[
      {key:'noOfSites',     label:'No. of Sites',         type:'number'},
      {key:'noOfLocations', label:'No. of Locations',     type:'number'},
      {key:'siteType',      label:'Site Type',            type:'select',
       options:['School','Hospital','Library','Transport Hub','Barangay Hall','Plaza','Other']},
      {key:'simsDistrib',   label:'SIMs Distributed',     type:'number'},
      {key:'simTarget',     label:'SIM Target',           type:'number'}
    ]
  },

  'GovNet': {
    code:'GOVNET', color:'#c27803', icon:'🌐',
    targetSectors:['NGA','LGU','SUC','Public School'],
    modes:['On-Site','Face-to-Face'],
    extraFields:[
      {key:'sitesMaintained', label:'GovNet Sites Maintained', type:'number'},
      {key:'connectionType',  label:'Connection Type',         type:'select',
       options:['Fiber','Wireless','Satellite','Leased Line']},
      {key:'bandwidthMbps',   label:'Bandwidth (Mbps)',        type:'number'}
    ]
  },

  'NBP': {
    code:'NBP', color:'#e02424', icon:'🔗',
    targetSectors:['NGA','LGU','Educational Institutions','Public Health Facilities',
                   'Financial Institutions','Remote and Underserved Communities'],
    modes:['On-Site','Face-to-Face'],
    extraFields:[
      {key:'ongoingSites',   label:'Ongoing Implementation Sites', type:'number'},
      {key:'nfbPhase',       label:'NFB Phase',                    type:'select',
       options:['Phase 1','Phase 2','Phase 3']},
      {key:'assistanceType', label:'Type of Assistance',           type:'text'}
    ]
  },

  'Cybersecurity': {
    code:'CYBER', color:'#ff5a1f', icon:'🛡',
    targetSectors:['NGA','LGU','PWD','PDL','Students','Out-of-School Youth',
                   'MSMEs','Senior Citizens','Parents','Private Sector','Women','Communities'],
    modes:['Face-to-Face','Online','Hybrid','On-Site'],
    extraFields:[
      {key:'noOfActivities',   label:'No. of Cyber Activities (Cumulative)', type:'number'},
      {key:'noOfParticipants', label:'No. of Participants (Cumulative)',      type:'number'},
      {key:'awarenessType',    label:'Awareness Type',                       type:'select',
       options:['Awareness Campaign','Training','Seminar','Workshop','Info Drive']}
    ]
  },

  'PNPKI': {
    code:'PNPKI', color:'#1c64f2', icon:'🔑',
    targetSectors:['NGA','LGU','Private Sector'],
    modes:['Face-to-Face','Online','Hybrid','On-Site'],
    extraFields:[
      {key:'orientations',   label:'No. of Orientations / Engagements',    type:'number'},
      {key:'appProcessed',   label:'No. of Processed Applications',        type:'number'},
      {key:'techAssistance', label:'No. of Technical Assistance',          type:'number'},
      {key:'appType',        label:'Application Type',                     type:'select',
       options:['New','Renewal','Revocation']},
      {key:'applicantOrg',   label:'Applicant Organization',              type:'text'}
    ]
  },

  'DRRM': {
    code:'DRRM', color:'#e3a008', icon:'⚠️',
    targetSectors:['All Sector'],
    modes:['On-Site','Face-to-Face'],
    extraFields:[
      {key:'exerciseType',    label:'Exercise / Drill Type',      type:'text'},
      {key:'equipment',       label:'Equipment Evaluated',        type:'text'},
      {key:'commsProject',    label:'Communication Project',      type:'text'},
      {key:'simsDistrib',     label:'SIMs Distributed',          type:'number'}
    ]
  },

  'ILCDB': {
    code:'ILCDB', color:'#046c4e', icon:'🎓',
    targetSectors:['NGA','LGU','PWD','PDL','Students','Out-of-School Youth',
                   'MSMEs','Senior Citizens','Private Sector','Women','Communities'],
    modes:['Face-to-Face','Online','Hybrid','On-Site'],
    extraFields:[
      {key:'subProgram',      label:'Sub-Program',              type:'select',
       options:['Project Click','SPARK','DTC (Digital Transformation Centers)','F2F Info Session','Other']},
      {key:'noOfTrainees',    label:'No. of Trainees',         type:'number'},
      {key:'duration',        label:'Duration (hrs/days)',     type:'text'},
      {key:'courseTitle',     label:'Course / Module Title',  type:'text'},
      {key:'certsIssued',     label:'Certificates Issued',    type:'number'}
    ]
  },

  'IIDB': {
    code:'IIDB', color:'#5521b5', icon:'📈',
    targetSectors:['NDA','MSMEs','Freelancing Industry','Startup Industry',
                   'Academe / HEIs','LGU','IT-BPM Industry','Civil Society',
                   'Students','Emerging Tech Industry','Other Private Stakeholders'],
    modes:['On-Site','Face-to-Face'],
    extraFields:[
      {key:'partnershipType', label:'Partnership Type',            type:'select',
       options:['MOA','MOU','Partnership','Collaboration','Other']},
      {key:'noOfPartnerships',label:'Partnerships Developed',     type:'number'},
      {key:'emergingTech',    label:'Emerging Tech Capability',   type:'text'},
      {key:'ictRoadmap',      label:'ICT Roadmap Implementation', type:'number'},
      {key:'conferenceType',  label:'ICT Conference Type',        type:'text'}
    ]
  },

  'Activities': {
    code:'MASTER', color:'#1a4f8a', icon:'📋',
    targetSectors:['All Sector'],
    modes:['Face-to-Face','Online','Hybrid'],
    extraFields:[]
  }
};

// ── STATIC CONFIG ─────────────────────────────────────────────────
var REF_SHEET   = '_Reference';
var DASH_SHEET  = 'Dashboard';
var HEADER_ROW  = 1;
var MAX_IMAGES  = 10;
var MONTHS = ['January','February','March','April','May','June',
              'July','August','September','October','November','December'];
var MODES    = ['Face-to-Face','Online','Hybrid','On-Site'];
var STATUSES = ['Completed','Ongoing','Cancelled','For Submission','Pending'];
var AAR_VALS = ['Submitted','For Submission','Not Required','N/A'];
var YEARS    = ['2024','2025','2026','2027'];

// ── R5 GEO DATA ───────────────────────────────────────────────────
var R5 = {
  'Albay': {
    'Legazpi City': ['Arimbay','Bagumbayan','Banquerohan','Bariis','Bigaa','Bonot','Buyuan','Gogon','Homapon','Matanog','Padang','Pawa','Pigcale','Rawis','Sagpon','San Joaquin','San Roque','Tamaoyan','Taysan','Tinago','Tula-tula','Victory Village','Pob. Brgy 1','Pob. Brgy 2','Pob. Brgy 3'],
    'Daraga':      ['Bagacay','Bigaa','Buenavista','Busay','Calinawan','Cambayog','Cararayan','Carolina','Casili','Castilla','Del Rosario','Gapo','Ilawod','Ilaya','Lughan','Malinao','Mayon','Miramar','Odoc','Opon','Palapas','Pandan','Salvacion','San Francisco','San Isidro','San Jose','San Rafael','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo','Sapang'],
    'Ligao City':  ['Allang','Amtic','Baligang','Barayong','Bariw','Bubulusan','Calzada','Cavasi','Culliat','Dunao','Guilid','Guruyan','Herrera','Macalidong','Maonon','Nabonton','Oacan','Paulog','Pinagdapian','Ponso','Porocan','Sabangan','Salvacion','San Francisco','San Migel','Silago','Sta. Cruz','Sta. Elena','Talabon','Talaba','Tinago','Tomolin'],
    'Tabaco City': ['Baranghawon','Basud','Bombon','Bonga','Buyo','Cobo','Comon','Corcoran','Culliat','Fatima','Gogon Sirangan','Hacienda','Lalud','Libod','Lidong','Lourdes','Mabini','Magnao','Martinay','Matnog','Miisi','Palanog','Palo','Panal','Pantao','Pigcale','Quirino','Rawis','Sagrada','Salvacion','San Antonio','San Juan','San Lorenzo','San Ramon','San Roque','Victory','Ziga'],
    'Guinobatan':  ['Alobo','Amoguis','Apud','Baligang','Banao','Buga','Buhatan','Caguiba','Calzada','Canaway','Casini','Cobo','Conalum','Dogongan','Francia','Gabawan','Hacienda','Inamnan Grande','Inamnan Pequeño','Inapatan','Kalayaan','Magsaysay','Mapaco','Mauraro','Nabonton','Nato','Nonu','Palo','Pawili','Salvacion','San Francisco','San Jose','San Pascual','San Ramon','San Roque','Santa Cruz','Sula','Sumlang','Tagaytay','Tambo','Tanawan'],
    'Camalig':     ['Anoling','Baligang','Banao','Bonga','Bubulusan','Buenavista','Busay','Cabraran Grande','Cabraran Pequeño','Caguiba','Cotmon','Cugna','Culliat','Del Rosario','Gapo','Gibacao','Halawig','Ilawod','Ilaya','Maguiron','Malinao','Malo','Nabonton','Palanog','Paulog','Poot','Quirangay','Salvacion','Salugan','San Isidro','San Jose','San Lucas','San Marcos','San Miguel','Santa Cruz','Tagas','Taloto','Tominawog'],
    'Oas':         ['Agos','Altavas','Banao','Bariw','Basud','Bato','Bonga','Bulala','Busay','Cagmanaba','Cobo','Del Rosario','Guruyan','Hanawan','Kilantaao','Lourdes','Nabonton','Paloyon','Panoypoy','Paulog','Pili','Polangi','Rizal','Sabang','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Marcos','San Miguel','San Pablo','San Pascual','San Ramon','San Roque','Santa Cruz','Santo Domingo','Sugcad','Tagas','Tigbi'],
    'Polangui':    ['Agos','Alimbuyog','Alnay','Amoguis','Anopol','Balaba','Balinad','Banao','Basag','Bato','Buga','Calaguimit','Calpi','Coalicion','Cobo','Cotmon','Danao','Dunao','Guruyan','Ilawod','Ilaya','Iraya','Labog','Malinao','Maonon','Mapaco','Masarawag','Maynaga','Mendez','Naga','Ombao','Paloyon','Pandan','Polo','Salvacion','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Miguel','San Roque','Santa Cruz','Santo Domingo','Sugcad','Tagpu','Tambo','Tanawan'],
    'Tiwi':        ['Bagumbayan','Bariis','Batang','Batolinao','Buyo','Cabasan','Cale','Cararayan','Cogon','Dayhagan','Don Basilio','Joroan','Libjo','Libtong','Lourdes','Matalipni','Maynonong','Mayong','Miisi','Naga','Nagas','Pandan','Putsan','Sagrada','San Bernardo','San Miguel','San Vicente','Tigbi'],
    'Malilipot':   ['Bacong','Bariis','Basud','Bay','Calbayog','Caguiba','Coyaoyao','Lidong','Mabinit','Malinao','Maughan','Nabonton','Paoay','Parabcan','Quirangay','Sagrada','San Antonio','San Isidro','San Jose','San Roque','Santa Misericordia','Santo Nino','Tobog'],
    'Bacacay':     ['Baclayon','Banao','Busdak','Cagraray','Cawayan','Cayo','Cobo','Conao','Cubog','Damacan','Ilawod','Iraya','Kinalansan','Kinawayan','Leona','Mampurog','Mananao','Mapula','Marbel','Nabonton','Nagas','Napo','Pawa','Pili','Salvacion','San Esteban','San Francisco','San Jose','San Mateo','San Pascual','Soa'],
    'Jovellar':    ['Agao','Bacolod','Banao','Baras','Bogtong','Buenavista','Busay','Calzada','Canaway','Cawayan','Gaba','Gumahan','Gulang-gulang','Hubo','Imos','Labnig','Mabulo','Naga','Nagas','Naobay','Napo','Pawa','Pili','Polot','Sabang','Salvacion','San Francisco','San Isidro','San Jose','San Juan','San Pascual','San Rafael','Santa Cruz','Santa Elena','Santo Nino','Soa','Solaro','Tagas','Togawe','Tuburan','Uacon','Zaragoza'],
    'Santo Domingo':['Alimsog','Arimbay','Banacud','Bonga','Buyo','Calaguimit','Cobo','Culasi','Haligue','Ilawod','Ilaya','Kinamlatan','La Medalla','Lanigay','Layon','Mabini','Matnog','Nagas','Nabunto','Napo','Naro','Olandia','Padang','Palali Norte','Palali Sur','Ramirez','Salvacion','San Jose','Santa Cruz','Tagoytoy','Tambo','Tanaon','Tinago'],
    'Libon':       ['Agos','Bahao','Bakiad','Baligang','Banao','Barayong','Bigaa','Binanuahan','Busay','Cagmanaba','Calzada','Canaway','Casini','Cobo','Cotmon','Culliat','Danao','Del Rosario','Dunao','Guruyan','Hanawan','Ilawod','Ilaya','Kinalansan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Lubong','Lughan','Mabini','Malinao','Malo','Matnog','Miisi','Nabonton','Napo','Olandia','Palo','Paloyon','Plaridel','Polot','Poon','Sagrada','Salvacion','San Andres','San Esteban','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Marcos','San Miguel','San Pablo','San Rafael','San Roque','Santa Cruz','Santo Nino','Solaro','Tagas','Tambo','Tinago','Togawe','Tuburan','Uacon'],
    'Malinao':     ['Baligang','Banao','Cabasan','Cabuyao','Calzada','Canituan','Capucnasan','Casabahan','Causip','Cobo','Dapdap','Diaro','Estancia','Kinalabasahan','Malnao','Mambajao','Manamoc','Manumbalay','Nagas','Napo','Napongawan','Osmeña','Padang','Paloyon','Panao','Pandan','Panique','Quilicot','Sagrada','Salvacion','San Andres','San Isidro','San Jose','San Ramon','Sirab','Solaro','Tagoroc','Tambo','Tampadong'],
    'Pio Duran':   ['Agao','Bigaon','Calaguimit','Catagbacan','Del Carmen','Elipidio Quirino','Gumahan','Haligue','Lourdes','Mabini','Magsaysay','Naga','Palali Sur','San Antonio','San Francisco','San Isidro','San Jose','San Ramon','Santa Cruz','Santo Nino'],
    'Rapu-Rapu':   ['Batan','Bugang','Cabugao','Cagraray','Gaba','Galicia','Hamorawon','Lagundi','Linao','Linas','Mapula','Mayutin','Nagcalsot','Pagcolbon','Poblacion','Poctol','San Andres','San Francisco','San Isidro','San Jose','San Miguel','San Ramon']
  },
  'Camarines Norte': {
    'Daet':           ['Alawihao','Awitan','Bagasbas','Pob. I','Pob. II','Pob. III','Pob. IV','Pob. V','Pob. VI','Pob. VII','Pob. VIII','Borabod','Calasgasan','Camambugan','Cobangbang','Dogongan','Georgia','Lag-on','Lalawigan','Lamon','Macalelon','Mancruz','Pamorangon','San Isidro'],
    'Labo':           ['Anahaw','Angas','Apuao','Baay','Bagong Silang','Bakiad','Balo','Banogon','Pob. I','Pob. II','Pob. III','Pob. IV','Bato','Bilbilang','Binanuahan','Bulala','Cabusay','Calandagan','Del Rosario','Guinacutan','Hampang','La Purisima','Lugui','Mabilo I','Mabilo II','Macogon','Magdalena','Magsaysay','Malasugui','Mambulo Nuevo','Mambulo Viejo','Masalong','Matacong','Mocong','Molinao','Napaod','Osmeña','Pag-Asa','Pandanan','Rosario','Salvacion','San Antonio','San Felipe','San Francisco','San Isidro','San Jose','Santa Cruz','Santa Elena','Santo Domingo','Singi','Taisan','Tulay'],
    'Jose Panganiban':['Bagong Bayan','Calero','Dahican','Dayhagan','Guinlajon','Hagonghong','Illa','Larap','Lubigan','Luklukan Norte','Luklukan Sur','Mabato','Macadlang','Magang','Maniktik','Matnog','Napaod','Osmeña','Pag-Asa','Plaridel','Salvacion','San Isidro','Sta. Rosa Norte','Sta. Rosa Sur','Talisay','Tigkiw','Tinambac','Tulay'],
    'Capalonga':      ['Abaca','Alayao','Binawangan','Cabatuan','Calabaca','Camambugan','Cocok-Cabitan','Daguit','Danao','Giamong','Guinlajon','Laniton','Macogon','Magsaysay','Matango','Mataong','Napaod','Oring','Pag-Asa','Pangpang','Plaridel','Salvacion','San Isidro','San Lorenzo','San Vicente','Santa Elena','Tibang','Tinambac','Tulay'],
    'Santa Elena':    ['Aldezar','Alem','Amparado','Balite','Bongo','Buenavista','Bulhao','Cabugao','Cagaycay','Cagnipa','Calero','Calinao','Canaway','Dumagpit','Gingaroy','Guinlajon','Guisican','Larap','Lubigan','Luklukan','Macadlang','Magang','Malinao','Napaod','Osmeña','Plaridel','Pocdol','Salvacion','San Isidro','San Lorenzo','San Vicente','Santa Cruz','Santa Rosa','Talisay','Tulay'],
    'Paracale':       ['Bagumbayan','Gahon','Labnig','Labo','Langga','Mabilo','Mahaba','Malangcao','Malay','Malinao','Managpi','Mangkasay','Manlimba','Mercedes','Napaod','Osmeña','Pag-Asa','Plaridel','Salvacion','San Isidro','San Lorenzo','San Vicente','Santa Cruz','Taisan','Talisay','Tulay'],
    'Vinzons':        ['Alsam Ilaya','Alsam Ilawod','Awitan','Azalea','Bautista','Bayabas','Bulawit','Cabanbanan','Calabasa','Calangcawan','Caloocan','Canapawan','Codon','Coroconog','Dagang','Dangla','Del Pilar','Guitol','Himanag','Iraya','Kuyaoyao','La Purisima','Lugui','Mabilo','Magsaysay','Malangcao','Manlimba','Napaod','Osmeña','Pob. I','Pob. II','Pob. III','Pob. IV','Salvacion','San Isidro','San Lorenzo','San Vicente','Santa Elena','Sugod','Tawog','Tinambac','Tulay'],
    'Basud':          ['Aguit-it','Caima','Calasag','Canaway','Capuy','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Magdalena','Maisog','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Presbitero','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Marcos','San Miguel','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Siembre','Sugod','Sulong','Taban','Tagnipa','Taisan','Tinago'],
    'Mercedes':       ['Bay','Calauag','Camambugan','Cawayan','Concepcion','Del Rosario','Guadalupe','Laniton','Mabini','Malapad','Malaguit','Mambalite','Mercedes Pob.','Napaod','Oring','Pag-Asa','Pangpang','Plaridel','Salvacion','San Isidro','San Lorenzo','San Vicente','Santa Cruz','Talisay','Tulay'],
    'San Lorenzo':    ['Amorong','Awitan','Bagong Bayan','Bahay','Buenavista','Bulalacao','Bungkag','Cabusay','Calagbangan','Calanigan','Calon','Camambugan','Canaway','Dalnac','Del Rosario','Ilawod','Iraya','Laniton','Lugui','Mabini','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Salvacion','San Antonio','San Isidro','San Jose','San Mateo','San Miguel','San Pedro','Santa Cruz','Santo Nino','Taisan','Talisay','Tulay'],
    'San Vicente':    ['Alayao','Bitaogan','Buenavista','Bulalacao','Busay','Calagbangan','Calanigan','Camambugan','Canaway','Del Rosario','Ilawod','Iraya','Laniton','Lugui','Mabini','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Salvacion','San Antonio','San Isidro','San Jose','San Mateo','San Miguel','San Pedro','Santa Cruz','Taisan','Tulay'],
    'Talisay':        ['Apuao','Awitan','Bagasbas','Baybay','Buenavista','Calasgasan','Calatagan','Camambugan','Cobangbang','Dadap','Del Rosario','Ilawod','Iraya','Lugui','Mabini','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Pob. III','Salvacion','San Isidro','San Jose','San Miguel','Santa Cruz','Taisan','Tulay'],
    'Tulay na Lupa':  ['Abano','Calagbangan','Calanigan','Calon','Camambugan','Del Rosario','Ilawod','Iraya','Lugui','Mabini','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Salvacion','San Isidro','San Jose','Santa Cruz','Taisan','Tulay']
  },
  'Camarines Sur': {
    'Naga City':    ['Abella','Bagumbayan Norte','Bagumbayan Sur','Balatas','Calauag','Cararayan','Carolina','Concepcion Pequeño','Dayangdang','Del Rosario','Dinaga','Igualdad Interior','Lerma','Liboton','Mabolo','Pacol','Panicuason','Sabang','San Felipe','San Francisco','San Isidro','Santa Cruz','Tabuco','Tinago','Triangulo'],
    'Iriga City':   ['Antipolo','Aro-aldao','Bagong Bayan','Belen','Betania','Bula','Bulihan','Casay','La Anunciacion','La Medalla','La Purisima','La Trinidad','Lourdes','Mabini','Perpetual Succor','Progreso','Sagrada Familia','San Agustin','San Francisco','San Isidro','San Joaquin','San Jose','San Juan','San Nicolas','San Roque','San Vicente','Santa Cruz','Santa Elena','Santo Nino'],
    'Pili':         ['Abucayan Norte','Abucayan Sur','Adiangao','Bagong Sirang','Palestina','Pawili','Sagrada','Sagurong','San Jose','San Vicente','Santa Cruz','Tagbong','Poblacion'],
    'Libmanan':     ['Awayan','Bagong Sirang','Bahao','Bahay','Balongay','Bical','Buyo','Caima','Calasuche','Cararayan','Caridad','Casay','Catalotoan','Del Carmen','Kinalansan','Lanipga','Liboro','Loba-loba','Manapao','Mangga','Maraganit','Pamplona','Pamplonita','Pinagdapian','Pinit','Polantuna','Presbitero','Responsong','Salvacion','San Agustin','San Antonio','San Isidro','San Jose','San Juan','San Lucas','San Pablo','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo','Sulong','Taban'],
    'Goa':          ['Bagadion','Bagong Sirang','Bamban','Belen','Buyo','Cabagrayan','Calagmitan','Calampinay','Calanigan Norte','Calanigan Sur','Cupa','Del Rosario','Halawig','Hidhid','La Purisima','Laguio','Lagumit','Lalo','Mansalaya','Nagkalit','Palangon','Palina','Pantao','Sagrada','Salvacion','San Andres','San Francisco','San Isidro','San Jose','San Pablo','San Vicente','Santa Cruz','Santo Domingo','Sooc','Tibi'],
    'Camaligan':    ['Dugcal','Pam-puraw','San Jose Norte','San Jose Sur','San Juan','San Marcos','San Nicolas','San Pablo'],
    'Calabanga':    ['Balongay','Batang','Binanuahan','Burabod','Cagsao','Camagong','Cararayan','Casay','Catanusan','Del Carmen','Dinaga','Dugcal','Gaongan','Hanawan','Labnig','Lalawigan','Layon','Lidong','Lourdes','Lugsad','Mabini','Manapao','Manlabong','Marupit','Matacla','Matalon','Mina-anog','Naguilian','Ocampo','Palong','Pamplona','Pawili','Pinagdapian','Polantuna','Presbitero','Pugay','Sabang','Salvacion','San Andres','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Miguel','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Sinuknipan','Supang','Taban','Tagnipa','Talusan','Tinago','Togawe','Tuburan'],
    'Sipocot':      ['Aldezar','Aluang','Anopol','Antipolo','Apuao','Bagong Sirang','Bahay','Balongay','Banlas','Bato','Bical Norte','Bical Sur','Biga','Boton','Burabod','Cabangcalan','Cagsao','Calasuche','Calumpit','Carangcang','Casay','Causip','Codon','Dalupaon','Duang Niog Norte','Ginorte','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Maculabog','Malbong','Malinao','Mambulo','Manapao','Mangga','Manquiring','Matacla','Matalibong','Mina-anog','Molinao','Pag-Asa','Palong','Pamplona','Pamplonita','Panganiban','Patag','Pawili','Plaridel','Polantuna','Presbitero','Ramos','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Marcos','San Miguel','San Pablo','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo','Sugod','Sulong','Taban','Tagnipa','Taisan','Tinago'],
    'Tinambac':     ['Aldezar','Ayugan','Baboy','Bagacay','Bagong Sirang','Bahay','Balinad','Barobaybay','Bataan','Bato','Bayawas','Binanuahan','Bongalon','Bulala Norte','Bulala Sur','Cagdarao','Calao','Cantugas','Cocok','Domagondong','Dungao','Ermita','Gibgos','Gingaroy','Gubat','Guindayonan','Haguimit','Labnig','Libnogon','Lidong','Lubigan'],
    'Baao':         ['Ajuy','Awayan','Bagot','Balawing','Banag','Belen','Bonot','Cabatuan','Canapawan','Cararayan','Del Rosario','Ditan','Guinapatan','Ilaya','Magpanambo','Magurang','Malabnay','Pob. I','Pob. II','Pob. III','Salvacion','San Agustin','San Isidro','San Jose','San Pablo','San Roque','San Vicente'],
    'Balatan':      ['Agos','Awayan','Bagasbas','Bangon','Buenavista','Busay','Cabatuan','Calasuche','Calzada','Camambugan','Cararayan','Casay','Causip','Cobo','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Bato':         ['Agos','Awayan','Bangon','Buenavista','Busay','Cabatuan','Calasuche','Calzada','Camambugan','Cararayan','Casay','Causip','Cobo','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Pag-Asa','Palong','Pamplona','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Bombon':       ['Cararayan','Dugcal','Pam-puraw','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Buhi':         ['Adovis','Angas','Antipolo','Buhi Pob.','Cabatuan','Calawit','Caraycayon','Casay','Causip','Cobo','Codon','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Bula':         ['Agos','Antipolo','Caima','Calasag','Camambugan','Canaway','Capuy','Del Carmen','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Cabusao':      ['Bagong Sirang','Cararayan','Dugcal','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Canaman':      ['Cararayan','Dinaga','Dugcal','Mangayawan','Pob. Norte','Pob. Sur','San Agustin','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Del Gallego':  ['Agos','Antipolo','Badak','Burabod','Caima','Calasag','Camambugan','Canaway','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Gainza':       ['Cararayan','Dugcal','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz','Tinago'],
    'Lupi':         ['Agos','Antipolo','Burabod','Caima','Calasag','Camambugan','Canaway','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Magarao':      ['Barobaybay','Cararayan','Del Carmen','Dugcal','Malitbog','Ponong','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Milaor':       ['Cararayan','Dugcal','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Minalabac':    ['Antipolo','Barobaybay','Burabod','Cararayan','Del Carmen','Dugcal','Malitbog','Ponong','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Nabua':        ['Agos','Awayan','Bagasbas','Bangon','Buenavista','Busay','Cabatuan','Calasuche','Calzada','Camambugan','Cararayan','Casay','Causip','Cobo','Codon','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Presbitero','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Ocampo':       ['Agos','Awayan','Bagasbas','Bangon','Buenavista','Busay','Cabatuan','Camambugan','Cararayan','Casay','Causip','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Presbitero','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Pamplona':     ['Agos','Antipolo','Burabod','Caima','Calasag','Camambugan','Canaway','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Pasacao':      ['Antipolo','Barobaybay','Burabod','Cararayan','Del Carmen','Dugcal','Malitbog','Ponong','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'Ragay':        ['Agos','Antipolo','Badak','Burabod','Caima','Calasag','Camambugan','Canaway','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Sagñay':       ['Bagacay','Buyo','Calpi','Canomay','Cogon','Dacu','Dawis','Del Carmen','Divisoria','Esperanza','Gabi','Imelda','Iniwaran','Jison','Lanipao','Lourdes','Luklukan','Mabini','Madrona','Malubago','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Salvacion','San Antonio','San Isidro','San Roque','San Vicente','Santa Cruz','Tagbon','Talisay'],
    'San Fernando': ['Cararayan','Dugcal','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Nicolas','San Pablo','Santa Cruz'],
    'San Jose':     ['Agos','Antipolo','Burabod','Caima','Calasag','Camambugan','Canaway','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose Pob.','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Siruma':       ['Agos','Antipolo','Burabod','Caima','Calasag','Camambugan','Del Carmen','Guruyan','Hanawan','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Tigaon':       ['Bagacay','Buyo','Calpi','Canomay','Cogon','Dacu','Dawis','Del Carmen','Divisoria','Esperanza','Gabi','Imelda','Iniwaran','Jison','Lanipao','Lourdes','Luklukan','Mabini','Madrona','Malubago','Napaod','Osmeña','Pag-Asa','Pangpang','Plaridel','Pob. I','Pob. II','Salvacion','San Antonio','San Isidro','San Roque','San Vicente','Santa Cruz','Tagbon','Talisay']
  },
  'Catanduanes': {
    'Virac':      ['Balite','Batong Paloway','Bigaa','Buenavista','Busay','Cabcab','Calatagan','Caloocan','Camansinay','Carogcog','Casoocan','Concepcion','Constantino','Dalnac','Dugui San Isidro','Dugui Too','Francia','Gogon','Igang','Lubid','Mabitin','Mabini','Marinawa','Ogbong','Pajo','Palhi','Pao','Pili','Porog','Puro','Rantao','Rawis','Salvacion','San Isidro','San Jose','San Juan','San Pablo','Santa Cruz','Santo Domingo','Tabaco','Tibo','Tinago','Togawe','Tubaon','Villahermosa'],
    'Bato':       ['Bato','Maynawa','Ogatad','Panique','Sagrada','San Jose','San Vicente','Santa Cruz'],
    'Bagamanoc':  ['Agao','Baibay','Bislig','Bote','Burabod','Cabasagan','Cagnipa','Calolbon','Catandayagan','Colongcolong','Guinsaugon','Hidhid','Iligan','Imba','Itok','Malinao','Mauraro','Napo','Pangpang','Patag','Pob. I','Pob. II','Polnot','Potol','Puro','Rantao','San Jose','San Rafael','San Roque','Tabog'],
    'Baras':      ['Bagumbayan','Bato','Buenavista','Busay','Calpi','Cararayan','Cogon','Cruzada','Dalnac','Del Rosario','Francia','Hamorawon','Igang','Iquin','Labnig','Lidong','Lourdes','Mabitin','Malinao','Nagas','Napo','Ogbong','Pao','Patag','Rawis','Salvacion','San Isidro','San Jose','San Juan','Santa Cruz','Tibo'],
    'Gigmoto':    ['Gigmoto','San Andres','Buod','Cabcab','Guinsaugon','Washington'],
    'Pandan':     ['Alas','Alibihaban','Bagahanglad','Balite','Bato','Biong','Buhatan','Burabod','Cabcab','Calauag','Calatagan','Camambugan','Carangcang','Casoocan','Causip','Cobo','Codon','Daan','Datag','Dayhagan','Del Rosario','Francia','Gogon','Guintinua','Igang','Inalmasiw','Iraya','Kilantaao','Lag-on','Layon','Lidong','Lubid','Lugsad','Mabilo','Malinao','Matnog','Miisi','Nagas','Nato','Naro','Ogbong','Pajo','Palhi','Pao','Patag','Pawili','Pili','Porog','Puro','Rantao','Rawis','Sabang','Sagrada','Salvacion','San Andres','San Francisco','San Isidro','San Jose','San Juan','San Marcos','San Miguel','San Pablo','San Ramon','San Roque','San Vicente','Santa Cruz','Tagas','Tambo','Tibo','Tinago','Togawe','Tuburan'],
    'Panganiban': ['Agao','Baibay','Bislig','Bote','Burabod','Cabasagan','Cagnipa','Calolbon','Catandayagan','Colongcolong','Guinsaugon','Hidhid','Iligan','Imba','Itok','Malinao','Mauraro','Pangpang','Patag','Pob. I','Pob. II','Polnot','Potol','Puro','Rantao','San Jose','San Rafael','San Roque'],
    'San Andres': ['Alibijaban','Cabanbanan','Cabiguhan','Camp Uno','Cawayanin','Hatpan','Lalaguna','Lawak','Magsaysay','Malinao','Natorco','Osmeña','Pag-Asa','Piñahan','Plaridel','Poblacion','Rizal','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Roque','San Vicente','Santa Cruz','Santo Nino','Ulag'],
    'San Miguel': ['Aguiba','Alibijaban','Bagahanglad','Balite','Bato','Biong','Buhatan','Burabod','Busay','Cabcab','Calauag','Calatagan','Camambugan','Carangcang','Casoocan','Causip','Cobo','Codon','Daan','Del Rosario','Francia','Gogon','Guintinua','Igang','Inalmasiw','Iraya','Kilantaao','Lag-on','Layon','Lidong','Lubid','Lugsad','Mabilo','Malinao','Nagas','Nato','Ogbong','Pao','Patag','Pili','Porog','Puro','Rawis','Sabang','Sagrada','Salvacion','San Andres','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Marcos','San Miguel Pob.','San Pablo','San Ramon','San Roque','San Vicente','Santa Cruz','Tagas','Tambo','Tibo','Tinago','Togawe'],
    'Viga':       ['Bagumbayan','Batan','Buyo','Calatagan','Palnab','Patag','Salvacion','San Isidro','San Jose','San Miguel','San Pablo','San Roque','Santa Cruz','Tigaon','Timbaan']
  },
    'Masbate': {
    'Masbate City': ['Asid','Baguiw','Balawing','Bantigue','Bapor Pob.','Batuan','Bayandong','Binocot','Biyong','Bukal','Cabuyao','Cagba','Cawayan','Espinosa','F. Magallanes','Ibingay','Igang','Kinamaligan','Langub','Maangas','Malibas','Zone I Pob.','Zone II Pob.','Zone III Pob.','Zone IV Pob.','Zone V Pob.','Zone VI Pob.','Mongahon','Nursery','Palatog','Pating-pating','Pawa','Rizal','San Antonio','San Fernando','San Jose','San Rafael','Tugbo','Usab','Zafra'],
    'Aroroy':      ['Aroroy Pob.','Bagahanglad','Balawing','Bangon','Buenavista','Busay','Cabog','Calanigan','Camambugan','Canapawan','Cararayan','Casay','Causip','Cobo','Codon','Del Carmen','Del Rosario','Guruyan','Hanawan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Pamplona','Plaridel','Polantuna','Presbitero','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo'],
    'Baleno':      ['Baleno Pob.','Bangon','Buenavista','Busay','Calanigan','Camambugan','Cararayan','Casay','Causip','Cobo','Del Carmen','Del Rosario','Guruyan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Agustin','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Balud':       ['Balud Pob.','Bangon','Buenavista','Calanigan','Camambugan','Cararayan','Casay','Causip','Cobo','Del Carmen','Del Rosario','Guruyan','Labnig','La Medalla','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Batuan':      ['Batuan Pob.','Buenavista','Busay','Calanigan','Camambugan','Cararayan','Casay','Causip','Cobo','Del Carmen','Del Rosario','Guruyan','Labnig','Lalawigan','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Polantuna','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Lucas','San Pablo','San Pedro','San Ramon','San Roque','San Vicente','Santa Cruz'],
    'Cataingan':   ['Bagsa','Baleno','Baligang','Bangon','Bicavao','Binaonga','Bolo','Bontod','Bugao','Butag','Cabitan','Calumpang','Canares','Cogon','Cuya','Dapdap','Estampar','Gerona','Guiom','Hantig','Higaonon','Jardin','Lanang','Mabini','Madamba','Malapoc','Mapanique','Mapasok','Nauro','Pajo','Palsong','Pantao','Pawa','Pineda','Placer','Plaridel','Poblacion','Pulot','Quibangay','San Agustin','San Antonio','San Isidro','San Jose','San Lucas','San Marcos','San Pablo','San Pedro','San Rafael','San Ramon','San Vicente','Sinuknipan','Taboc','Talisay','Tunga-tunga'],
    'Cawayan':     ['Aguada','Bagahanglad','Bagong Silang','Balawing','Biga','Bobon','Bonifacio','Bugtong','Busay','Cambaguio','Canomay','Cogon','Dacu','Don Pablo Reyes','Divisoria','Esperanza','Gahit','Ibho','La Esperanza','Lagta','Laguinbanua Oeste','Laguinbanua Este','Libertad','Libtong','Malogon','Maot','Matin-ao','Nabangig','Obispo','Palatog','Pangana','Pob. I','Pob. II','Pob. III','Pondol','Rizal','Salvacion','San Eduardo','San Isidro','San Jose','San Pablo','San Rafael','Santa Cruz','Santo Nino','Sawang','Sinuknipan','Tagpu','Tugbo','Tulay Matanda'],
    'Dimasalang':  ['Dimasalang Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Mandaon':     ['Mandaon Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Milagros':    ['Agoho','Anas','Banase','Binalay','Buhatan','Busing','Calumpang','Canomay','Caridad','Celis','Compostela','Concordia','Dungon','Esperanza','F. Magallanes','Fortaleza','Gaid','Gango','Ilawod','Inas','Legarda','Libertad','Mabini','Malapoc','Malumbang','Manoboc','Marcella','Nasugbo','Pantao','Pawa','Perpetua','Poblacion','Quezon','Quinayangan','Rizal','Roble','Sabang','Salvacion','San Antonio','San Isidro','San Jose','San Lorenzo','San Marcos','San Pedro','San Rafael','San Roque','San Vicente','Santa Cruz','Santo Tomas','Sinuknipan','Tagbon','Tago','Tanque','Tinago','Tinawagan','Tugbo'],
    'Mobo':        ['Mobo Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Monreal':     ['Monreal Pob.','Agos','Buenavista','Camambugan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Palanas':     ['Palanas Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Pio V. Corpuz':['Pio V. Corpuz Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Placer':      ['Ambolong','Calumpang','Canomay','Cogon','Dacu','Dawis','Divisoria','Esperanza','Famoso','Gabi','Imelda','Iniwaran','Jison','Lanipao','Lourdes','Luklukan','Mabini','Madrona','Malubago','Mancao','Muyong','Naagom','Naobay','Nasudlon','Obrero','Pinamarbuhan','Plaridel','Pob. I','Pob. II','Quezon','Rizal','Salvacion','San Antonio','San Isidro','San Roque','San Vicente','Santa Cruz','Santo Nino','Sihi','Tagbon','Talisay','Tominanga','Tubigan'],
    'San Fernando':['San Fernando Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'San Jacinto': ['San Jacinto Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'San Pascual': ['San Pascual Pob.','Agos','Buenavista','Camambugan','Cararayan','Casay','Del Carmen','Guruyan','Labnig','Layon','Lidong','Lourdes','Mabini','Malinao','Napaod','Osmeña','Pag-Asa','Palong','Plaridel','Responsong','Rizal','Sabang','Sagrada','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lorenzo','San Roque','San Vicente','Santa Cruz'],
    'Uson':        ['Buenavista','Calasuche','Calumpang','Canahaw','Canipaan','Dangcalan','Del Carmen','Esperanza','F. Magallanes','Famoso','Gabi','Imelda','Iniwaran','Jison','Lanipao','Lourdes','Luklukan','Mabini','Madrona','Malubago','Maluco','Mancao','Muyong','Naagom','Naobay','Nasudlon','Obrero','Pinamarbuhan','Plaridel','Poblacion','Quezon','Rizal','Salvacion','San Antonio','San Isidro','San Roque','San Vicente','Santa Cruz','Santo Nino','Sihi','Sinuknipan','Tagbon','Talisay','Tominanga','Tubigan']
  },
 
  'Sorsogon': {
    'Sorsogon City':   ['Abuyog','Almendras-Cogon Pob.','Anjauan','Bacang','Bao','Barayong','Bical Norte','Bical Sur','Bonga','Bucalbucalan','Buhatan','Bulabog','Burabod Pob.','Cabid-an','Cambulaga','Capuy','Caridad','Cararayan','Macabog','Magallanes','Marinab','Mayon','Milagrosa','Pangpang Pob.','Panlayaan','Piot Pob.','Polvorista Pob.','Quidolog','Quimbao Pob.','Rawis','Rizal','Salog Pob.','Sampang','San Isidro','San Juan Bautista Pob.','San Juan Nepomuceno Pob.','San Pedro Pob.','Sawangan Pob.','Sibago','Siuton','Sulucan Pob.','Sumaoy','Talisay','Tigbao','Timbayog','Tiris','Togbon','Trinidad Pob.'],
    'Donsol':          ['Agoho','Awai','Banban','Behia','Buenavista','Bulawan','Burgos','Dapdap','Dancalan','Dobo','Ferreras','Iquig','Lourdes','Mabini','Mapaso','Ogod','Pandan','Pawili','Pepita','Pob. Norte','Pob. Sur','San Isidro','San Jose','San Rafael','San Ramon','Sibago','Sua','Tigbao','Tinangyuan','Tongdol','Trece Martires','Tugos'],
    'Bulan':           ['Ablao','Bagacay','Bagalaya','Bagatao','Balaogan','Balite','Balocawe','Balud','Baquilod','Bato','Beguin','Binisitahan del Norte','Binisitahan del Sur','Buenavista','Cadandanan','Cogon Norte','Cogon Sur','Danao','Del Carmen','España','Gabao','Gatbo','Gibacao','Gogon','Gumahan','Guruyan','Ilawod','Ilaya','Israel','Kilikao','Lapinig Grande','Lapinig Pequeño','Lumbang','Mabini','Magallanes','Magsaysay','Malacondi','Malanay','Malibago','Manambit','Mapula','Masoli','Mayos','Milagrosa','Nabuo','Naobay','Naro','Pacifico','Pag-Asa','Pagsangahan','Palale','Palanas','Paloyon','Pamurayan','Pangpang','Pawili','Polot','Progreso','Putiao','Rangas','Rizal','Sagkahan','Salvacion','San Antonio','San Francisco','San Isidro','San Jose','San Juan','San Lucas','San Marcos','San Miguel','San Pablo','San Pascual','San Pedro','San Rafael','San Ramon','San Roque','San Vicente','Santa Cruz','Santo Domingo','Sinuknipan','Siuton','Subic','Sugod','Sulangan','Sulong','Sumaoy','Tagdon','Tagas','Tago','Talaba','Tinawagan','Tinoog','Tolongkiaw','Tulay','Tupaz'],
    'Irosin':          ['Bagsangan','Batang','Bolos','Buenavista','Cogon','Gabao','Gulang-gulang','Guruyan','Macawiwili','Mapaso','Monbon','Nabune','Pag-Asa','Patag','Polot','Porocan','Potipot','San Agustin','San Isidro','San Juan','San Pedro','Santa Remedios','Tinampo'],
    'Gubat':           ['Ariman','Bagacay','Balud','Banuang Gurang','Bentuco','Beriran','Biga','Binisihan','Buenavista','Bulacao','Bulala','Cabiguhan','Cagusbus','Calapanes','Calpi','Cawit Grande','Cawit Pequeño','Colambis','Dalnac','Danao','Elimla','Gabao','Gajo','Gambong','Hidhid','Lago','Lajong','Macalaya','Manapao','Mancao','Manlabong','Matnog','Monbon','Namo','Olympia','Osmeña','Paco','Paghaluban','Palale','Panacuan','Pandan Niog','Patag','Pawili','Polot','Porocan','Quezon','Quipia','Rizal','Sabang','Salvacion','San Isidro','San Jose','San Juan','San Pedro','San Rafael','San Ramon','San Roque','Santa Cruz','Santo Nino','Somogod','Sugod','Tiui','Togawe','Tongo','Tugas','Tulay','Tultula','Viga'],
    'Barcelona':       ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Casiguran','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalagtay','Tugos','Villahermosa'],
    'Casiguran':       ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Caloocan','Casiguran Pob.','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos','Villahermosa'],
    'Castilla':        ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Casiguran','Castilla Pob.','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos'],
    'Juban':           ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Casiguran','Cogon','Gabao','Inlagadian','Juban Pob.','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos'],
    'Magallanes':      ['Bagacay','Buhatan','Busay','Caloocan','Capuy','Casiguran','Castillo','Cogon','Gabao','Inlagadian','Lagasca','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','San Pascual','Sawangan','Tignoan','Tomalaytay','Tugos'],
    'Matnog':          ['Bagong Sirang','Buhatan','Calpi','Caloocan','Casiguran','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog Pob.','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos'],
    'Pilar':           ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Casiguran','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Pilar Pob.','Sawangan','Tignoan','Tomalagtay','Tugos'],
    'Prieto Diaz':     ['Bagong Sirang','Buhatan','Calpi','Caloocan','Casiguran','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos'],
    'Santa Magdalena': ['Bagong Sirang','Buhatan','Bulawan','Cabaroan','Calpi','Casiguran','Cogon','Gabao','Inlagadian','Lubi','Mahamud','Mapasok','Matnog','Pago','Pamurayan','Sawangan','Tignoan','Tomalaytay','Tugos']
  }
};


function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 DICT R5')
    .addSubMenu(ui.createMenu('🛠 Setup')
      .addItem('Build / repair all sheets',   'setupAllSheets')
      .addItem('Build / repair current sheet','setupCurrentSheet')
      .addItem('Repair validations (this sheet)','repairValidations')
      .addItem('Repair validations — all sheets',  'repairValidationsAllSheets')
      .addItem('Clean phantom rows (this sheet)','cleanPhantomRows')
      .addItem('Clean phantom rows — all sheets', 'cleanPhantomRowsAllSheets')
      .addItem('Install onEdit trigger',      'installOnEditTrigger')
      .addItem('Rebuild Dashboard',           'refreshDashboard'))
    .addSeparator()
    .addItem('➕ Add Activity (smart)',  'openSmartAddDialog')
    .addItem('📅 Date picker',           'openDatePicker')
    .addSubMenu(ui.createMenu('🖼 Images')
      .addItem('View images for row',      'openImageViewer')
      .addItem('Upload images for row',    'openImageUploadDialog')
      .addItem('Refresh images (this sheet)', 'refreshAllImages')
      .addItem('Refresh images (all sheets)', 'refreshAllImagesAllSheets'))
    .addSeparator()
    .addSubMenu(ui.createMenu('🔄 Sync')
      .addItem('Sync current row',   'syncCurrentRow')
      .addItem('Sync all rows (this sheet)', 'syncAllRows')
      .addItem('Rebuild Activities master',  'rebuildActivitiesMaster')
      .addItem('Find orphan rows',           'findOrphanRows')
      .addItem('Fill defaults on orphan rows','fillMissingFields')
      .addItem('Test webhook',       'testWebhook'))
    .addSubMenu(ui.createMenu('🧪 Sample Data')
      .addItem('Generate for this sheet',  'generateFakeDataCurrentSheet')
      .addItem('Generate for all sheets',  'generateFakeDataAllSheets'))
    .addSeparator()
    .addItem('📈 Show sheet status',     'showSheetStatus')
    .addSubMenu(ui.createMenu('🗑 Clear')
      .addItem('Clear current sheet', 'clearCurrentSheet')
      .addItem('Clear all sheets',    'clearAllSheets'))
    .addToUi();
}

// ================================================================
//  SETUP
// ================================================================
// Builds / repairs EVERY sheet defined in PROGRAM_SCHEMA, including
// sheets that don't yet exist (e.g. the Activities master sheet).
function setupAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  buildReferenceSheet(ss);
  var created = 0, repaired = 0;
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    var sht = ss.getSheetByName(name);
    if (!sht) { sht = ss.insertSheet(name); created++; }
    else { repaired++; }
    setupProgramSheet(sht, name);
  });
  buildDashboard(ss);
  installOnEditTrigger();
  SpreadsheetApp.getUi().alert(
    'DICT R5 PMS v6 Setup Complete!\n\n' +
    '✅ Created ' + created + ' new sheet(s), repaired ' + repaired + '\n' +
    '✅ Per-program extra field columns added\n' +
    '✅ Smart Add Activity dialog ready\n' +
    '✅ Image viewer sidebar ready\n' +
    '✅ Cascading Province > LGU > Barangay\n' +
    '✅ Dashboard refreshed\n\n' +
    'Use "➕ Add Activity (smart)" to enter data.'
  );
}

// Legacy alias — keeps old menu entries working.
function setupEverything() { setupAllSheets(); }

// Rebuild just the currently-active program sheet.
function setupCurrentSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) {
    SpreadsheetApp.getUi().alert('"' + name + '" is not a recognised program sheet.');
    return;
  }
  setupProgramSheet(sheet, name);
  SpreadsheetApp.getActiveSpreadsheet().toast('Rebuilt "' + name + '"', '✅', 3);
}

// Fix sheets that were built with strict validation (the
// "data validation rules" popup). Clears LGU/Barangay validation
// and reapplies it in flexible mode so custom entries only get
// a warning icon.
function repairValidations() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) {
    SpreadsheetApp.getUi().alert('Not a program sheet.');
    return;
  }
  // Make sure native / program-specific / coordinate headers exist
  // before we start re-applying validations on top of them.
  enforceExtraFieldHeaders(sheet, name);
  ensureCoordinatesHeader(sheet, name);

  // Nuke ALL validation across the entire data area (cols 1-40, rows
  // 2-1001). This removes stray rules that may have been applied to
  // the wrong column by an older schema (e.g. Mode validation ending
  // up on the Personnel column — the L4 popup cause). Note: the
  // Coordinates column is free-text so nothing gets re-applied there.
  var WIDE = 1000;
  sheet.getRange(2, 1, WIDE, 40).clearDataValidations();
  // Reapply Province in flex mode for the whole range.
  sheet.getRange(2, C.PROVINCE, WIDE).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(Object.keys(R5), true)
      .setAllowInvalid(true).build()
  );
  // Rebuild per-row LGU / Barangay flex dropdowns where a Province is filled in.
  var last = sheet.getLastRow();
  for (var r = 2; r <= last; r++) {
    var prov = sheet.getRange(r, C.PROVINCE).getValue();
    var lgu  = sheet.getRange(r, C.LGU).getValue();
    if (prov && R5[prov]) {
      setDropdownOnCell(sheet, r, C.LGU, Object.keys(R5[prov]));
      if (lgu && R5[prov][lgu]) setBarangayDropdown(sheet, r, prov, lgu);
    }
  }
  // Re-apply the flexible enum dropdowns for Mode/Status/AAR/Year/Month.
  var schema = PROGRAM_SCHEMA[name];
  setStaticDropdown(sheet, C.MODE,   schema.modes || MODES);
  setStaticDropdown(sheet, C.STATUS, STATUSES);
  setStaticDropdown(sheet, C.AAR,    AAR_VALS);
  setStaticDropdown(sheet, C.YEAR,   YEARS);
  setStaticDropdown(sheet, C.MONTH,  MONTHS);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Validations repaired across ' + WIDE + ' rows — Mode / Status / LGU / Barangay etc. now allow custom entries.', '✅', 7
  );
}

// Cleans phantom / ghost rows that inflate getLastRow() and push new
// entries to row 500+. Deletes every row below the last row that has
// an Activity Title. Formulas, banding and validation on the deleted
// rows are removed; they get re-applied next time you run Setup.
function cleanPhantomRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  var lastRow = sheet.getLastRow();
  // Find the deepest row with a real Activity Title (col F).
  var titles = sheet.getRange(2, C.ACTIVITY, Math.max(lastRow - 1, 1)).getValues();
  var realLast = 1;
  for (var i = 0; i < titles.length; i++) {
    if (String(titles[i][0]).trim()) realLast = i + 2;
  }
  var maxRows = sheet.getMaxRows();
  var keepUntil = Math.max(realLast + 5, 20); // leave a small buffer
  if (maxRows > keepUntil) {
    sheet.deleteRows(keepUntil + 1, maxRows - keepUntil);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Trimmed sheet to ' + keepUntil + ' rows. New entries now start at row ' + (realLast + 1) + '.',
    '🧹', 6
  );
}

// Quick sheet-level summary as a toast.
function showSheetStatus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Not a program sheet.', '⚠️', 4);
    return;
  }
  var last = sheet.getLastRow();
  var filled = 0, completed = 0, pax = 0;
  for (var r = 2; r <= last; r++) {
    if (sheet.getRange(r, C.ACTIVITY).getValue()) filled++;
    if (sheet.getRange(r, C.STATUS).getValue() === 'Completed') completed++;
    var v = sheet.getRange(r, C.TOTAL_PAX).getValue();
    if (typeof v === 'number') pax += v;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(
    filled + ' activities · ' + completed + ' completed · ' + pax + ' pax',
    '📊 ' + name, 6
  );
}

// Sync whichever row the cursor is on.
function syncCurrentRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  var row   = sheet.getActiveCell().getRow();
  if (row <= HEADER_ROW) { SpreadsheetApp.getUi().alert('Click on a data row first.'); return; }
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  syncRowToPMS(sheet, row, name);
  SpreadsheetApp.getActiveSpreadsheet().toast('Row ' + row + ' synced.', '✅', 3);
}

// ── Full headers = base + program extra fields + Coordinates ─────
// Coordinates is a native, first-class column appended after every
// program's extra fields. It lives at `coordinatesCol(sheetName)`
// = 32 + extraFields.length and stores "lat,lng" for Mapbox.
function getFullHeaders(sheetName) {
  var schema = PROGRAM_SCHEMA[sheetName];
  var extra  = schema ? schema.extraFields.map(function(f){ return f.label; }) : [];
  return BASE_HEADERS.concat(extra).concat(['Coordinates']);
}

function getExtraFieldCol(sheetName, fieldKey) {
  var schema = PROGRAM_SCHEMA[sheetName];
  if (!schema) return -1;
  for (var i = 0; i < schema.extraFields.length; i++) {
    if (schema.extraFields[i].key === fieldKey) return 32 + i;
  }
  return -1;
}

// ── Setup one program sheet ──────────────────────────────────────
function setupProgramSheet(sheet, sheetName) {
  var headers = getFullHeaders(sheetName);
  var schema  = PROGRAM_SCHEMA[sheetName] || { color:'#1a4f8a', extraFields:[] };

  // Header row styling
  var hColor = schema.color || '#1a4f8a';
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setBackground(hColor)
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setFontSize(10)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setWrap(true);
  sheet.setRowHeight(1, 44);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  // Base column widths (31) + extra fields
  var baseWidths = [110,130,150,60,90,220,180,180,100,100,110,160,
                    68,68,68,68,68,68,68,68,120,110,200,200,200,220,110,160,100,130,200];
  for (var i = 0; i < baseWidths.length; i++) sheet.setColumnWidth(i+1, baseWidths[i]);
  // Extra field columns: 140px each
  for (var j = 0; j < schema.extraFields.length; j++) sheet.setColumnWidth(32+j, 140);

  // Native Coordinates column (always right after the extras)
  var coordCol = 32 + schema.extraFields.length;
  sheet.setColumnWidth(coordCol, 160);
  sheet.getRange(1, coordCol)
       .setBackground('#0f172a').setFontColor('#ffd700').setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setNote('Format: "lat,lng" — used by the Mapbox map (e.g. 13.1391,123.7438).');
  sheet.getRange(2, coordCol, 500)
       .setBackground('#0b1220').setFontColor('#e5e7eb').setFontFamily('Roboto Mono')
       .setHorizontalAlignment('center').setNumberFormat('@');

  // Base dropdowns — province/year/month flexible, enums strict.
  setStaticDropdownFlex(sheet, C.PROVINCE, Object.keys(R5));
  setStaticDropdownFlex(sheet, C.MONTH,    MONTHS);
  setStaticDropdownFlex(sheet, C.YEAR,     YEARS);
  setStaticDropdown    (sheet, C.MODE,     schema.modes || MODES);
  setStaticDropdown    (sheet, C.STATUS,   STATUSES);
  setStaticDropdown    (sheet, C.AAR,      AAR_VALS);

  // Extra field dropdowns
  schema.extraFields.forEach(function(f, i) {
    var col = 32 + i;
    if (f.type === 'select' && f.options) {
      setStaticDropdown(sheet, col, f.options);
    }
    if (f.type === 'number') {
      sheet.getRange(2, col, 500).setHorizontalAlignment('center');
    }
    // Color extra field header distinctly
    sheet.getRange(1, col)
         .setBackground('#2d2d2d')
         .setFontColor('#ffd700')
         .setNote('Program-specific field: ' + f.key);
    // Color data cells
    sheet.getRange(2, col, 500).setBackground('#fffde7');
  });

  // Date formats
  sheet.getRange(2, C.START_DATE, 500).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build()
  ).setNumberFormat('MM/dd/yyyy');
  sheet.getRange(2, C.END_DATE, 500).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build()
  ).setNumberFormat('MM/dd/yyyy');

  // Total Pax formula — batched setFormulas (was 500 per-cell calls
  // which was the main cause of "Exceeded maximum execution time").
  var totalPaxFormulas = [];
  for (var r = 2; r <= 501; r++) {
    totalPaxFormulas.push(['=IF(COUNTA(M'+r+':T'+r+')=0,"",SUM(M'+r+':T'+r+'))']);
  }
  sheet.getRange(2, C.TOTAL_PAX, 500, 1).setFormulas(totalPaxFormulas);

  // Styling
  sheet.getRange(2,C.TOTAL_PAX,   500).setBackground('#e8f4fd').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(2,C.LAST_UPDATED,500).setBackground('#fff9e6').setHorizontalAlignment('center').setNumberFormat('MM/dd/yyyy HH:mm');
  sheet.getRange(2,C.DRIVE_LINK,  500).setBackground('#f0fff4').setFontColor('#0f5132');
  sheet.getRange(2,C.IMAGE_URLS,  500).setBackground('#e8f5e9').setFontSize(8).setWrap(true).setVerticalAlignment('top').setFontColor('#1b5e20');

  if (sheet.getBandings().length === 0) {
    sheet.getRange(2, 1, 500, 31).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  }
  applyStatusFormatting(sheet);
}

// ================================================================
//  SMART ADD ACTIVITY DIALOG  (program-aware)
// ================================================================
function openSmartAddDialog() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var name  = sheet.getName();
  var schema = PROGRAM_SCHEMA[name];

  if (!schema) {
    SpreadsheetApp.getUi().alert('Please navigate to a program sheet first (e.g. eGovPH, DRRM, etc.)');
    return;
  }

  var provinces = Object.keys(R5);
  var provOpts  = provinces.map(function(p){ return '<option>'+p+'</option>'; }).join('');
  var modeOpts  = (schema.modes||MODES).map(function(m){ return '<option>'+m+'</option>'; }).join('');
  var statOpts  = STATUSES.map(function(s){ return '<option>'+s+'</option>'; }).join('');
  var yearOpts  = YEARS.map(function(y){ return '<option>'+y+'</option>'; }).join('');
  var mnOpts    = MONTHS.map(function(m){ return '<option>'+m+'</option>'; }).join('');
  var arrOpts   = AAR_VALS.map(function(a){ return '<option>'+a+'</option>'; }).join('');

  // Build extra fields HTML
  var extraHtml = schema.extraFields.length > 0
    ? '<div class="section-hdr" style="color:'+schema.color+'">'+schema.icon+' '+name+'-Specific Fields</div>' +
      schema.extraFields.map(function(f){
        var inp;
        if (f.type==='select' && f.options) {
          inp = '<select id="ef_'+f.key+'">'+f.options.map(function(o){ return '<option>'+o+'</option>'; }).join('')+'</select>';
        } else if (f.type==='number') {
          inp = '<input type="number" id="ef_'+f.key+'" placeholder="0" min="0">';
        } else {
          inp = '<input type="text" id="ef_'+f.key+'" placeholder="'+( f.placeholder||f.label)+'">';
        }
        return '<label>'+f.label+'</label>'+inp;
      }).join('')
    : '';

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var curMn = MONTHS[new Date().getMonth()];
  var curYr = new Date().getFullYear().toString();

  var html = '<!DOCTYPE html><html><head><style>' +
    '*{box-sizing:border-box;}' +
    'body{font-family:Arial,sans-serif;padding:0;margin:0;background:#f8f9fa;font-size:12px;}' +
    '.header{background:'+schema.color+';color:#fff;padding:14px 18px;}' +
    '.header h3{margin:0;font-size:15px;}' +
    '.header p{margin:3px 0 0;font-size:11px;opacity:.85;}' +
    '.body{padding:14px 18px;overflow-y:auto;max-height:calc(100vh - 130px);}' +
    'label{font-weight:bold;color:#333;display:block;margin:8px 0 2px;}' +
    'input,select,textarea{width:100%;padding:7px 9px;border:1.5px solid #ddd;border-radius:5px;font-size:12px;}' +
    'textarea{height:55px;resize:vertical;}' +
    '.row2{display:flex;gap:8px;}.row2>div{flex:1;}' +
    '.section-hdr{margin:12px 0 6px;font-weight:bold;font-size:12px;border-bottom:2px solid '+schema.color+';padding-bottom:4px;}' +
    '.std-hdr{margin:12px 0 6px;font-weight:bold;font-size:12px;color:#1a4f8a;border-bottom:2px solid #1a4f8a;padding-bottom:4px;}' +
    '.footer{position:sticky;bottom:0;background:#fff;padding:10px 18px;border-top:1px solid #e0e0e0;display:flex;gap:8px;}' +
    'button{flex:1;padding:10px;border:none;border-radius:6px;font-size:13px;font-weight:bold;cursor:pointer;}' +
    '.btn-save{background:'+schema.color+';color:#fff;}' +
    '.btn-cancel{background:#e0e0e0;color:#333;}' +
    '.pax-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;}' +
    '.pax-grid label{font-size:10px;margin:0;}' +
    '.pax-grid input{padding:5px;font-size:12px;}' +
    '</style></head><body>' +
    '<div class="header">' +
    '<h3>'+schema.icon+' Add Activity — '+name+'</h3>' +
    '<p>'+name+' Program · DICT Region V</p>' +
    '</div>' +
    '<div class="body">' +

    // Location
    '<div class="std-hdr">📍 Location</div>' +
    '<div class="row2">' +
    '<div><label>Province</label><select id="prov" onchange="loadLGUs()">'+provOpts+'</select></div>' +
    '<div><label>LGU</label><select id="lgu" onchange="loadBrgys()"><option>— select province —</option></select></div>' +
    '<div><label>Barangay</label><select id="brgy"><option>— select LGU —</option></select></div>' +
    '</div>' +

    // Schedule
    '<div class="std-hdr">📅 Schedule</div>' +
    '<div class="row2">' +
    '<div><label>Year</label><select id="yr">'+yearOpts+'</select></div>' +
    '<div><label>Month</label><select id="mn">'+mnOpts+'</select></div>' +
    '<div><label>Start Date</label><input type="date" id="sd" value="'+today+'"></div>' +
    '<div><label>End Date</label><input type="date" id="ed" value="'+today+'"></div>' +
    '</div>' +

    // Activity details
    '<div class="std-hdr">📋 Activity Details</div>' +
    '<label>Activity Title *</label><input type="text" id="title" placeholder="e.g. '+name+' Orientation Seminar">' +
    '<div class="row2">' +
    '<div><label>Venue</label><input type="text" id="venue" placeholder="e.g. Municipal Hall"></div>' +
    '<div><label>Mode</label><select id="mode">'+modeOpts+'</select></div>' +
    '</div>' +
    '<label>Partner Organizations</label><input type="text" id="partners" placeholder="e.g. DTI Albay, LGU Legazpi">' +
    '<label>DICT Personnel</label><input type="text" id="personnel" placeholder="e.g. Juan Dela Cruz, Maria Santos">' +

    // Participants
    '<div class="std-hdr">👥 Participants</div>' +
    '<div class="pax-grid">' +
    '<div><label>NGA ♂</label><input type="number" id="nga_m" value="0" min="0"></div>' +
    '<div><label>NGA ♀</label><input type="number" id="nga_f" value="0" min="0"></div>' +
    '<div><label>LGU ♂</label><input type="number" id="lgu_m" value="0" min="0"></div>' +
    '<div><label>LGU ♀</label><input type="number" id="lgu_f" value="0" min="0"></div>' +
    '<div><label>SUC ♂</label><input type="number" id="suc_m" value="0" min="0"></div>' +
    '<div><label>SUC ♀</label><input type="number" id="suc_f" value="0" min="0"></div>' +
    '<div><label>Others ♂</label><input type="number" id="oth_m" value="0" min="0"></div>' +
    '<div><label>Others ♀</label><input type="number" id="oth_f" value="0" min="0"></div>' +
    '</div>' +
    '<div class="row2" style="margin-top:6px">' +
    '<div><label>Others Label</label><input type="text" id="oth_lbl" placeholder="e.g. MSME Owners, Teachers..."></div>' +
    '</div>' +

    // Reporting
    '<div class="std-hdr">📝 Reporting</div>' +
    '<div class="row2">' +
    '<div><label>After Activity Report</label><select id="aar">'+arrOpts+'</select></div>' +
    '<div><label>Status</label><select id="status">'+statOpts+'</select></div>' +
    '</div>' +
    '<label>FB Posting Link</label><input type="text" id="fb" placeholder="facebook.com/...">' +
    '<label>Raw Photos Link</label><input type="text" id="photos" placeholder="drive.google.com/...">' +
    '<label>Testimonials Link</label><input type="text" id="testi" placeholder="drive.google.com/...">' +
    '<label>Remarks</label><textarea id="remarks" placeholder="Notes, observations..."></textarea>' +

    // Program-specific extra fields
    (extraHtml ? '<div>' + extraHtml + '</div>' : '') +

    '</div>' + // end .body

    '<div class="footer">' +
    '<button class="btn-cancel" onclick="google.script.host.close()">Cancel</button>' +
    '<button class="btn-save" onclick="save()">💾 Save Activity</button>' +
    '</div>' +

    '<script>' +
    'var R5='+JSON.stringify(R5)+';' +
    'function loadLGUs(){' +
    '  var p=document.getElementById("prov").value;' +
    '  var lgus=R5[p]?Object.keys(R5[p]):[];' +
    '  var s=document.getElementById("lgu");' +
    '  s.innerHTML=lgus.map(function(l){return"<option>"+l+"</option>";}).join("");' +
    '  loadBrgys();' +
    '}' +
    'function loadBrgys(){' +
    '  var p=document.getElementById("prov").value;' +
    '  var l=document.getElementById("lgu").value;' +
    '  var bs=R5[p]&&R5[p][l]?R5[p][l]:[];' +
    '  var s=document.getElementById("brgy");' +
    '  s.innerHTML=bs.map(function(b){return"<option>"+b+"</option>";}).join("");' +
    '}' +
    'loadLGUs();' + // init

    // Gather extra fields
    'function getExtraFields(){' +
    '  var ef={};' +
    (schema.extraFields.map(function(f){
      return '  try{ef["'+f.key+'"]=document.getElementById("ef_'+f.key+'").value;}catch(e){}';
    }).join('\n')) +
    '  return ef;' +
    '}' +

    'function save(){' +
    '  var title=document.getElementById("title").value.trim();' +
    '  if(!title){alert("Activity Title is required.");return;}' +
    '  var btn=document.querySelector(".btn-save");' +
    '  btn.disabled=true;btn.textContent="Saving...";' +
    '  var data={' +
    '    prov:document.getElementById("prov").value,' +
    '    lgu:document.getElementById("lgu").value,' +
    '    brgy:document.getElementById("brgy").value,' +
    '    yr:document.getElementById("yr").value,' +
    '    mn:document.getElementById("mn").value,' +
    '    sd:document.getElementById("sd").value,' +
    '    ed:document.getElementById("ed").value,' +
    '    title:title,' +
    '    venue:document.getElementById("venue").value,' +
    '    mode:document.getElementById("mode").value,' +
    '    partners:document.getElementById("partners").value,' +
    '    personnel:document.getElementById("personnel").value,' +
    '    nga_m:document.getElementById("nga_m").value,' +
    '    nga_f:document.getElementById("nga_f").value,' +
    '    lgu_m:document.getElementById("lgu_m").value,' +
    '    lgu_f:document.getElementById("lgu_f").value,' +
    '    suc_m:document.getElementById("suc_m").value,' +
    '    suc_f:document.getElementById("suc_f").value,' +
    '    oth_m:document.getElementById("oth_m").value,' +
    '    oth_f:document.getElementById("oth_f").value,' +
    '    oth_lbl:document.getElementById("oth_lbl").value,' +
    '    aar:document.getElementById("aar").value,' +
    '    status:document.getElementById("status").value,' +
    '    fb:document.getElementById("fb").value,' +
    '    photos:document.getElementById("photos").value,' +
    '    testi:document.getElementById("testi").value,' +
    '    remarks:document.getElementById("remarks").value,' +
    '    extraFields:getExtraFields()' +
    '  };' +
    '  google.script.run' +
    '    .withSuccessHandler(function(m){alert(m);google.script.host.close();})' +
    '    .withFailureHandler(function(e){btn.disabled=false;btn.textContent="💾 Save Activity";alert("Error: "+e.message);})' +
    '    .saveActivityFromDialog(data);' +
    '}' +
    '<\/script></body></html>';

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('Add Activity — '+name)
  );
}

// ── Write the submitted dialog data to the sheet ─────────────────
function saveActivityFromDialog(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var name  = sheet.getName();
  var schema = PROGRAM_SCHEMA[name];
  if (!schema) return 'Error: Not on a program sheet.';

  var row = Math.max(sheet.getLastRow() + 1, 2);

  // Parse dates
  var sdParts = (data.sd||'').split('-');
  var edParts = (data.ed||'').split('-');
  var sd = sdParts.length===3 ? new Date(+sdParts[0],+sdParts[1]-1,+sdParts[2]) : new Date();
  var ed = edParts.length===3 ? new Date(+edParts[0],+edParts[1]-1,+edParts[2]) : sd;

  // Base 31 columns
  var base = new Array(31).fill('');
  base[C.PROVINCE-1]    = data.prov;
  base[C.LGU-1]         = data.lgu;
  base[C.BARANGAY-1]    = data.brgy;
  base[C.YEAR-1]        = parseInt(data.yr)||2025;
  base[C.MONTH-1]       = data.mn;
  base[C.ACTIVITY-1]    = data.title;
  base[C.VENUE-1]       = data.venue;
  base[C.PARTNERS-1]    = data.partners;
  base[C.START_DATE-1]  = sd;
  base[C.END_DATE-1]    = ed;
  base[C.MODE-1]        = data.mode;
  base[C.PERSONNEL-1]   = data.personnel;
  base[C.NGA_M-1]       = parseInt(data.nga_m)||0;
  base[C.NGA_F-1]       = parseInt(data.nga_f)||0;
  base[C.LGU_M-1]       = parseInt(data.lgu_m)||0;
  base[C.LGU_F-1]       = parseInt(data.lgu_f)||0;
  base[C.SUC_M-1]       = parseInt(data.suc_m)||0;
  base[C.SUC_F-1]       = parseInt(data.suc_f)||0;
  base[C.OTH_M-1]       = parseInt(data.oth_m)||0;
  base[C.OTH_F-1]       = parseInt(data.oth_f)||0;
  base[C.OTH_LABEL-1]   = data.oth_lbl;
  base[C.AAR-1]         = data.aar;
  base[C.FB_LINK-1]     = data.fb;
  base[C.PHOTOS_LINK-1] = data.photos;
  base[C.TESTI_LINK-1]  = data.testi;
  base[C.REMARKS-1]     = data.remarks;
  base[C.STATUS-1]      = data.status;
  base[C.DRIVE_LINK-1]  = '';
  base[C.TOTAL_PAX-1]   = '';
  base[C.LAST_UPDATED-1]= new Date();
  base[C.IMAGE_URLS-1]  = '';

  sheet.getRange(row, 1, 1, 31).setValues([base]);
  sheet.getRange(row, C.START_DATE).setNumberFormat('MM/dd/yyyy');
  sheet.getRange(row, C.END_DATE).setNumberFormat('MM/dd/yyyy');
  sheet.getRange(row, C.LAST_UPDATED).setNumberFormat('MM/dd/yyyy HH:mm');
  sheet.getRange(row, C.TOTAL_PAX)
       .setFormula('=IF(COUNTA(M'+row+':T'+row+')=0,"",SUM(M'+row+':T'+row+'))');

  // Write extra fields
  var ef = data.extraFields || {};
  schema.extraFields.forEach(function(f, i) {
    var val = ef[f.key] !== undefined ? ef[f.key] : '';
    if (f.type === 'number') val = parseFloat(val)||0;
    sheet.getRange(row, 32+i).setValue(val);
  });

  // Cascading dropdowns
  if (R5[data.prov]) {
    setDropdownOnCell(sheet, row, C.LGU, Object.keys(R5[data.prov]));
    if (R5[data.prov][data.lgu]) setBarangayDropdown(sheet, row, data.prov, data.lgu);
  }

  // Drive folder + images
  createDriveFolder(sheet, row, name, data.title);
  syncRowToPMS(sheet, row, name);
  mirrorToActivities(sheet, row, name);

  return '✅ Activity saved!\n"' + data.title + '"\nRow ' + row + ' (also mirrored to Activities sheet)';
}

// ================================================================
//  ACTIVITIES MASTER MIRROR
// ================================================================
// Copies a row from any program sheet into the Activities sheet so
// it becomes the single source-of-truth aggregate. The origin is
// tracked by a note on the Activity-Title cell in the form
// "source:<Program>:<sourceRow>" — subsequent edits update the same
// mirrored row instead of creating a duplicate.
function mirrorToActivities(sourceSheet, sourceRow, programName) {
  try {
    if (programName === 'Activities') return; // don't mirror the master into itself
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var act = ss.getSheetByName('Activities');
    if (!act) return; // Activities sheet missing — user hasn't run Setup yet
    ensureActivitiesExtraColumns(act);

    var data = sourceSheet.getRange(sourceRow, 1, 1, 31).getValues()[0];
    if (!String(data[C.ACTIVITY-1]||'').trim()) return; // skip empty rows

    var tag = 'source:' + programName + ':' + sourceRow;

    // Search existing mirrored rows for a matching tag note.
    var last    = act.getLastRow();
    var target  = -1;
    if (last >= 2) {
      var notes = act.getRange(2, C.ACTIVITY, last - 1).getNotes();
      for (var i = 0; i < notes.length; i++) {
        if (notes[i][0] === tag) { target = i + 2; break; }
      }
    }
    if (target === -1) target = Math.max(last + 1, 2);

    var schema = PROGRAM_SCHEMA[programName] || {};
    act.getRange(target, 1, 1, 31).setValues([data]);
    act.getRange(target, 32, 1, 2).setValues([[programName, schema.code || '']]);
    act.getRange(target, C.ACTIVITY).setNote(tag);
    act.getRange(target, C.START_DATE).setNumberFormat('MM/dd/yyyy');
    act.getRange(target, C.END_DATE).setNumberFormat('MM/dd/yyyy');
    act.getRange(target, C.LAST_UPDATED).setNumberFormat('MM/dd/yyyy HH:mm');
    act.getRange(target, C.TOTAL_PAX)
       .setFormula('=IF(COUNTA(M'+target+':T'+target+')=0,"",SUM(M'+target+':T'+target+'))');
    // Mirror Coordinates (col 34 on Activities) from source sheet.
    var srcCoordCol = coordinatesCol(programName);
    var srcCoord = String(sourceSheet.getRange(sourceRow, srcCoordCol).getValue()||'').trim();
    act.getRange(target, 34).setValue(srcCoord).setNumberFormat('@');
  } catch(e) { Logger.log('mirrorToActivities: ' + e); }
}

// Ensures the Activities sheet has "Program" and "Code" columns at
// positions 32 / 33 so mirrored rows can be distinguished by origin.
// Safe to call repeatedly — it's a no-op once the headers exist.
function ensureActivitiesExtraColumns(act) {
  act = act || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Activities');
  if (!act) return;
  var cur = act.getRange(1, 32, 1, 2).getValues()[0];
  if (cur[0] !== 'Program' || cur[1] !== 'Code') {
    act.getRange(1, 32, 1, 2)
       .setValues([['Program', 'Code']])
       .setBackground('#0f172a').setFontColor('#ffd700').setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setNote('Auto-populated by mirrorToActivities() — tracks which program sheet each row originated from.');
    act.setColumnWidth(32, 120);
    act.setColumnWidth(33, 90);
  }
  // Native Coordinates column at col 34.
  if (String(act.getRange(1, 34).getValue()||'').trim() !== 'Coordinates') {
    act.getRange(1, 34)
       .setValue('Coordinates')
       .setBackground('#0f172a').setFontColor('#ffd700').setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setNote('Mirrored from the source sheet. Format: "lat,lng" — used by the Mapbox map.');
    act.setColumnWidth(34, 160);
  }
}

// Bulk-rebuild the Activities sheet from every program sheet. Useful
// when Activities is out of sync or was just created by Setup.
// Bulk-rebuild the Activities sheet from every program sheet — fully
// batched (single setValues / setNotes / setFormulas per section) so
// even 500+ rows finish well under the 6-minute limit.
function rebuildActivitiesMaster() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var act = ss.getSheetByName('Activities');
  if (!act) { SpreadsheetApp.getUi().alert('Activities sheet missing. Run Setup first.'); return; }
  ensureActivitiesExtraColumns(act);

  // Clear existing data (keep headers + notes on row 1).
  var oldLast = act.getLastRow();
  if (oldLast > 1) {
    act.getRange(2, 1, oldLast - 1, Math.max(act.getLastColumn(), 33))
       .clear({contentsOnly:true, commentsOnly:false});
    act.getRange(2, C.ACTIVITY, oldLast - 1, 1).clearNote();
  }

  // Collect rows from every program sheet in bulk.
  var allRows = [], allNotes = [], allExtras = [], allCoords = [];
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    if (name === 'Activities') return;
    var sht = ss.getSheetByName(name);
    if (!sht) return;
    var last = sht.getLastRow();
    if (last < 2) return;
    var schema    = PROGRAM_SCHEMA[name] || {};
    var data      = sht.getRange(2, 1, last - 1, 31).getValues();
    var coordCol  = coordinatesCol(name);
    var coordData = sht.getRange(2, coordCol, last - 1, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (!String(data[i][C.ACTIVITY-1]||'').trim()) continue;
      allRows.push(data[i]);
      allNotes.push(['source:' + name + ':' + (i + 2)]);
      allExtras.push([name, schema.code || '']);
      allCoords.push([String(coordData[i][0]||'').trim()]);
    }
  });

  if (allRows.length === 0) {
    SpreadsheetApp.getUi().alert('No rows to mirror — all program sheets look empty.');
    return;
  }

  var n = allRows.length;
  act.getRange(2, 1,  n, 31).setValues(allRows);
  act.getRange(2, 32, n, 2 ).setValues(allExtras);
  act.getRange(2, 34, n, 1 ).setValues(allCoords).setNumberFormat('@');
  act.getRange(2, C.ACTIVITY, n, 1).setNotes(allNotes);

  // Total Pax formulas, batched.
  var tp = [];
  for (var j = 2; j < 2 + n; j++) {
    tp.push(['=IF(COUNTA(M'+j+':T'+j+')=0,"",SUM(M'+j+':T'+j+'))']);
  }
  act.getRange(2, C.TOTAL_PAX, n, 1).setFormulas(tp);

  // Date formats.
  act.getRange(2, C.START_DATE,   n).setNumberFormat('MM/dd/yyyy');
  act.getRange(2, C.END_DATE,     n).setNumberFormat('MM/dd/yyyy');
  act.getRange(2, C.LAST_UPDATED, n).setNumberFormat('MM/dd/yyyy HH:mm');

  SpreadsheetApp.getUi().alert(
    'Activities master rebuilt — mirrored ' + n + ' rows from all programs.\n' +
    'Program / Code columns (AF, AG) identify each row\'s origin.'
  );
}

// Scans every program sheet for rows that have an Activity Title but
// are missing Status or Total Pax — the likely cause of the "12 / 0 / 0"
// dashboard readings (e.g. ILCDB). Reports row numbers so the user
// can fix them manually.
function findOrphanRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    var sht = ss.getSheetByName(name);
    if (!sht) return;
    var last = sht.getLastRow();
    if (last < 2) return;
    var data = sht.getRange(2, 1, last - 1, 31).getValues();
    var bad = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!String(r[C.ACTIVITY-1]||'').trim()) continue;
      var missing = [];
      if (!String(r[C.STATUS-1]||'').trim()) missing.push('Status');
      var pax = (+r[C.NGA_M-1]||0)+(+r[C.NGA_F-1]||0)+(+r[C.LGU_M-1]||0)+(+r[C.LGU_F-1]||0)
              + (+r[C.SUC_M-1]||0)+(+r[C.SUC_F-1]||0)+(+r[C.OTH_M-1]||0)+(+r[C.OTH_F-1]||0);
      if (pax === 0) missing.push('Pax');
      if (missing.length) bad.push('  row ' + (i+2) + ' — missing ' + missing.join(', '));
    }
    if (bad.length) report.push('▸ ' + name + ' (' + bad.length + ' row(s)):\n' + bad.join('\n'));
  });
  SpreadsheetApp.getUi().alert(
    report.length
      ? 'Orphan rows found:\n\n' + report.join('\n\n') + '\n\nEdit these rows and set their Status / Pax to fix the dashboard.'
      : '✅ All rows have Status and Pax filled in.'
  );
}

// ================================================================
//  IMAGE VIEWER SIDEBAR
// ================================================================
function openImageViewer() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  var name  = sheet.getName();

  if (row <= HEADER_ROW) {
    SpreadsheetApp.getUi().alert('Click on a data row first, then open the Image Viewer.');
    return;
  }

  var title      = sheet.getRange(row, C.ACTIVITY).getValue() || '(no title)';
  var driveLink  = String(sheet.getRange(row, C.DRIVE_LINK).getValue() || '');
  var imageUrls  = String(sheet.getRange(row, C.IMAGE_URLS).getValue() || '');
  var schema     = PROGRAM_SCHEMA[name] || {color:'#1a4f8a', icon:'📋'};

  // Try to fetch latest images if we have a drive link
  var freshImages = [];
  if (driveLink) {
    freshImages = getActivityImages(driveLink);
    if (freshImages.length > 0) {
      sheet.getRange(row, C.IMAGE_URLS).setValue(freshImages.join('\n'));
      imageUrls = freshImages.join('\n');
    }
  }

  var urls = imageUrls.split('\n').filter(function(u){ return u.trim(); });

  var imgHtml = '';
  if (urls.length === 0) {
    imgHtml = '<div class="empty">📷 No images found.<br><br>' +
      (driveLink
        ? 'Upload photos to the <b>Raw Photos</b> subfolder in the activity\'s Drive folder, then re-open this viewer.'
        : 'Add a Drive Folder Link in column AB first.') +
      '</div>';
  } else {
    imgHtml = urls.map(function(url, i) {
      // Convert drive URL to direct image URL for embedding
      var match  = url.match(/id=([-\w]+)/);
      var fileId = match ? match[1] : '';
      // Use the thumbnail endpoint — works without auth for shared files
      var thumbUrl = fileId
        ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400'
        : url;
      var fullUrl  = fileId
        ? 'https://drive.google.com/file/d/' + fileId + '/view'
        : url;
      return '<div class="img-card">' +
        '<div class="img-num">'+(i+1)+'</div>' +
        '<a href="'+fullUrl+'" target="_blank" title="Open full size">' +
        '<img src="'+thumbUrl+'" onerror="this.src=\'https://via.placeholder.com/360x200?text=Cannot+Load+Image\'" loading="lazy">' +
        '</a>' +
        '<div class="img-footer">' +
        '<span class="img-name">Photo '+(i+1)+'</span>' +
        '<a href="'+fullUrl+'" target="_blank" class="btn-open">🔗 Open</a>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  var html = '<!DOCTYPE html><html><head><style>' +
    '*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{font-family:Arial,sans-serif;background:#f8f9fa;font-size:12px;}' +
    '.header{background:'+schema.color+';color:#fff;padding:12px 16px;}' +
    '.header h3{font-size:14px;margin-bottom:2px;}' +
    '.header p{font-size:11px;opacity:.85;}' +
    '.meta{background:#fff;padding:10px 16px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:10px;}' +
    '.badge{background:'+schema.color+';color:#fff;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:bold;}' +
    '.count{font-size:11px;color:#666;}' +
    '.toolbar{padding:8px 16px;display:flex;gap:8px;background:#fff;border-bottom:1px solid #e0e0e0;}' +
    '.btn{padding:6px 12px;border:none;border-radius:5px;font-size:11px;cursor:pointer;font-weight:bold;}' +
    '.btn-refresh{background:'+schema.color+';color:#fff;}' +
    '.btn-drive{background:#0e9f6e;color:#fff;}' +
    '.gallery{padding:12px 16px;overflow-y:auto;height:calc(100vh - 180px);}' +
    '.img-card{background:#fff;border-radius:8px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);}' +
    '.img-card img{width:100%;display:block;height:200px;object-fit:cover;background:#e0e0e0;}' +
    '.img-card img:hover{opacity:.9;}' +
    '.img-num{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;}' +
    '.img-card>a{position:relative;display:block;}' +
    '.img-footer{padding:8px 12px;display:flex;justify-content:space-between;align-items:center;}' +
    '.img-name{font-size:11px;color:#555;}' +
    '.btn-open{font-size:11px;color:'+schema.color+';text-decoration:none;font-weight:bold;}' +
    '.empty{text-align:center;padding:40px 20px;color:#888;line-height:1.8;}' +
    '</style></head><body>' +

    '<div class="header">' +
    '<h3>'+schema.icon+' Activity Images</h3>' +
    '<p>'+title+'</p>' +
    '</div>' +

    '<div class="meta">' +
    '<span class="badge">'+name+'</span>' +
    '<span class="count">'+urls.length+' image'+(urls.length!==1?'s':'')+' found</span>' +
    '</div>' +

    '<div class="toolbar">' +
    '<button class="btn btn-refresh" onclick="refresh()">🔄 Refresh Images</button>' +
    (driveLink ? '<button class="btn btn-drive" onclick="openDrive()">📁 Open Drive Folder</button>' : '') +
    '</div>' +

    '<div class="gallery">' + imgHtml + '</div>' +

    '<script>' +
    'function refresh(){' +
    '  document.querySelector(".btn-refresh").textContent="Refreshing...";' +
    '  google.script.run' +
    '    .withSuccessHandler(function(){google.script.run.withSuccessHandler(function(){window.location.reload();}).openImageViewer();})' +
    '    .refreshCurrentRowImages();' +
    '}' +
    (driveLink ? 'function openDrive(){window.open("'+driveLink+'","_blank");}' : '') +
    '<\/script></body></html>';

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('Image Viewer — ' + title.substring(0,40))
  );
}

// Refresh images for just the active cell's row
function refreshCurrentRowImages() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  if (row <= HEADER_ROW) return;
  var driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue() || '');
  if (!driveLink) return;
  var images = getActivityImages(driveLink);
  if (images.length > 0) writeImageUrls(sheet, row, images);
}

// ================================================================
//  IMAGE SYNC FUNCTIONS (unchanged from v4)
// ================================================================
function getActivityImages(driveFolderUrl) {
  if (!driveFolderUrl) return [];
  try {
    var match = driveFolderUrl.match(/[-\w]{25,}/);
    if (!match) return [];
    var folder       = DriveApp.getFolderById(match[0]);
    var photoFolders = folder.getFoldersByName('Raw Photos');
    if (!photoFolders.hasNext()) return [];
    var photosFolder = photoFolders.next();
    var files        = photosFolder.getFiles();
    var urls         = [];
    while (files.hasNext() && urls.length < MAX_IMAGES) {
      var file = files.next();
      if (file.getMimeType().indexOf('image/') === 0) {
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
        urls.push('https://drive.google.com/uc?id=' + file.getId());
      }
    }
    return urls;
  } catch(e) { Logger.log('getActivityImages: '+e); return []; }
}

function writeImageUrls(sheet, row, images) {
  if (images && images.length > 0) sheet.getRange(row, C.IMAGE_URLS).setValue(images.join('\n'));
}

function refreshAllImages() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  var last = sheet.getLastRow(), updated = 0, skipped = 0;
  for (var r = 2; r <= last; r++) {
    var dl = sheet.getRange(r, C.DRIVE_LINK).getValue();
    var t  = sheet.getRange(r, C.ACTIVITY).getValue();
    if (!dl || !t) { skipped++; continue; }
    var imgs = getActivityImages(String(dl));
    if (imgs.length > 0) { writeImageUrls(sheet, r, imgs); updated++; }
  }
  SpreadsheetApp.getUi().alert('Updated: '+updated+'  Skipped: '+skipped);
}

// ================================================================
//  IMAGE UPLOAD (row-scoped)
// ================================================================
// Opens a dialog to upload one or many images for the currently
// selected data row. Images are saved into that activity's Drive
// folder and their URLs written back into column AE.
function openImageUploadDialog() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row   = sheet.getActiveCell().getRow();
  var name  = sheet.getName();
  if (row <= HEADER_ROW) { SpreadsheetApp.getUi().alert('Click on a data row first.'); return; }
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  var title = String(sheet.getRange(row, C.ACTIVITY).getValue()||'').trim();
  if (!title) { SpreadsheetApp.getUi().alert('This row has no Activity Title yet. Add one first so a Drive folder can be created.'); return; }

  // Create the Drive folder on-demand if the row doesn't have one yet.
  var driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue()||'').trim();
  if (!driveLink) {
    createDriveFolder(sheet, row, name, title);
    driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue()||'').trim();
  }

  // Make sure the Coordinates column exists and read any existing value.
  ensureCoordinatesHeader(sheet, name);
  var coords = getRowCoordinates(sheet, row, name);
  var latStr = coords ? String(coords.lat) : '';
  var lngStr = coords ? String(coords.lng) : '';

  // Simple string replacement — safer than HtmlTemplate for values
  // that may contain quotes. Escape any embedded " for JS-string safety.
  function esc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"'); }
  var html = IMAGE_UPLOAD_HTML
    .replace(/__SHEET__/g, esc(name))
    .replace(/__ROW__/g,   String(row))
    .replace(/__TITLE__/g, esc(title))
    .replace(/__DRIVE__/g, esc(driveLink))
    .replace(/__LAT__/g,   esc(latStr))
    .replace(/__LNG__/g,   esc(lngStr));
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(540).setHeight(640),
    '🖼 Upload images — Row ' + row
  );
}

// Called from the upload dialog. files = array of
// { name, type, base64 } — saves each to the activity's Drive folder
// and returns the count + refreshed image URLs.
function uploadImagesToRow(sheetName, row, files) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet not found: ' + sheetName);
    var driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue()||'').trim();
    if (!driveLink) throw new Error('Row has no Drive folder. Add an Activity Title first.');
    var match = driveLink.match(/[-\w]{25,}/);
    if (!match) throw new Error('Could not parse Drive folder ID.');
    var folder = DriveApp.getFolderById(match[0]);

    var saved = 0;
    (files||[]).forEach(function(f) {
      if (!f || !f.base64) return;
      var bytes = Utilities.base64Decode(f.base64);
      var blob  = Utilities.newBlob(bytes, f.type || 'image/jpeg', f.name || ('image-'+Date.now()+'.jpg'));
      folder.createFile(blob);
      saved++;
    });

    // Refresh IMAGE_URLS from folder contents.
    var imgs = getActivityImages(driveLink);
    if (imgs.length) writeImageUrls(sheet, row, imgs);
    autoTimestamp(sheet, row);
    try { mirrorToActivities(sheet, row, sheetName); } catch(e) {}
    return { ok:true, saved:saved, total:imgs.length };
  } catch(e) {
    return { ok:false, error: String(e) };
  }
}

// Valid sub-folder names that the activity-folder scaffolder creates.
var UPLOAD_SUBFOLDERS = ['Raw Photos','After Activity Report','Testimonials','Supporting Documents'];

// Returns the target subfolder by name, creating it if missing.
function _getOrCreateSubfolder(parent, subName) {
  if (!subName) return parent;
  var it = parent.getFoldersByName(subName);
  return it.hasNext() ? it.next() : parent.createFolder(subName);
}

// Single-file backend so big uploads don't blow the HtmlService
// request-size limit. Accepts an optional subfolder (e.g. "Raw Photos")
// so files land in the right bucket inside the activity folder.
function uploadOneImageToRow(sheetName, row, file, subfolder) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet not found: ' + sheetName);
    var driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue()||'').trim();
    if (!driveLink) throw new Error('Row has no Drive folder. Add an Activity Title first.');
    var match = driveLink.match(/[-\w]{25,}/);
    if (!match) throw new Error('Could not parse Drive folder ID.');
    var parent = DriveApp.getFolderById(match[0]);
    var target = _getOrCreateSubfolder(parent, subfolder || 'Raw Photos');
    if (!file || !file.base64) throw new Error('Empty file payload.');
    var bytes = Utilities.base64Decode(file.base64);
    var blob  = Utilities.newBlob(bytes, file.type || 'image/jpeg', file.name || ('image-'+Date.now()+'.jpg'));
    var f     = target.createFile(blob);
    return { ok:true, url:f.getUrl(), name:f.getName(), subfolder: target.getName() };
  } catch(e) {
    return { ok:false, error: String(e && e.message || e) };
  }
}

// ================================================================
//  COORDINATES COLUMN (for Mapbox)
// ================================================================
// Coordinates live at the first column after all per-program extra
// fields, so no hardcoded column number is assumed. Value is stored
// as "lat,lng" (e.g. "13.1391,123.7438"). Mapbox integration reads
// it via getRowCoordinates(sheet, row).
function coordinatesCol(sheetName) {
  // Activities master keeps Program/Code at cols 32-33, so coords
  // land at col 34 there. Every other program sheet uses col
  // 32 + extraFields.length.
  if (sheetName === 'Activities') return 34;
  var schema = PROGRAM_SCHEMA[sheetName] || {};
  var extras = schema.extraFields ? schema.extraFields.length : 0;
  return 32 + extras;
}

function ensureCoordinatesHeader(sheet, name) {
  var col = coordinatesCol(name);
  var cell = sheet.getRange(1, col);
  if (String(cell.getValue()||'').trim() !== 'Coordinates') {
    cell.setValue('Coordinates')
        .setBackground('#0f172a').setFontColor('#ffd700').setFontWeight('bold')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
}

function getRowCoordinates(sheet, row, sheetName) {
  var col = coordinatesCol(sheetName || sheet.getName());
  var raw = String(sheet.getRange(row, col).getValue()||'').trim();
  if (!raw) return null;
  var parts = raw.split(',').map(function(s){ return parseFloat(String(s).trim()); });
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { lat: parts[0], lng: parts[1] };
}

function setRowCoordinates(sheet, row, sheetName, lat, lng) {
  ensureCoordinatesHeader(sheet, sheetName || sheet.getName());
  var col = coordinatesCol(sheetName || sheet.getName());
  if (lat === '' || lat === null || lat === undefined || lng === '' || lng === null || lng === undefined) {
    sheet.getRange(row, col).clearContent();
    return null;
  }
  var latN = parseFloat(lat), lngN = parseFloat(lng);
  if (isNaN(latN) || isNaN(lngN)) throw new Error('Invalid coordinates: ' + lat + ',' + lng);
  sheet.getRange(row, col).setValue(latN + ',' + lngN).setNumberFormat('@');
  return { lat: latN, lng: lngN };
}

// Called by the upload dialog when the user enters lat/lng along
// with files. Writes to the sheet and returns the saved coords.
function saveRowCoordinates(sheetName, row, lat, lng) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet not found: ' + sheetName);
    var coords = setRowCoordinates(sheet, row, sheetName, lat, lng);
    try { mirrorToActivities(sheet, row, sheetName); } catch(e) {}
    return { ok:true, coords: coords };
  } catch(e) {
    return { ok:false, error: String(e && e.message || e) };
  }
}

// Called after the last file has been uploaded — refreshes the
// Image URLs cell from folder contents so AE reflects reality.
function finalizeImageUpload(sheetName, row) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { ok:false, error:'Sheet not found' };
    var driveLink = String(sheet.getRange(row, C.DRIVE_LINK).getValue()||'').trim();
    if (!driveLink) return { ok:false, error:'No Drive link on row' };
    var imgs = getActivityImages(driveLink);
    if (imgs.length) writeImageUrls(sheet, row, imgs);
    autoTimestamp(sheet, row);
    try { mirrorToActivities(sheet, row, sheetName); } catch(e) {}
    return { ok:true, total: imgs.length };
  } catch(e) {
    return { ok:false, error: String(e && e.message || e) };
  }
}

// Using a template literal (backticks) so we don't have to escape
// every embedded quote in the browser JS. Placeholders __SHEET__ /
// __ROW__ / __TITLE__ / __DRIVE__ get swapped in by openImageUploadDialog.
var IMAGE_UPLOAD_HTML = `<!DOCTYPE html>
<html><head><base target="_top">
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#1e293b}
  h3{margin:0 0 4px 0;color:#1a4f8a}
  .meta{font-size:12px;color:#64748b;margin-bottom:12px}
  .drop{display:block;border:2px dashed #94a3b8;border-radius:8px;padding:26px;text-align:center;background:#fff;cursor:pointer;user-select:none}
  .drop.hover{border-color:#1a4f8a;background:#eff6ff}
  .drop p{margin:4px 0;font-size:13px}
  .drop input[type=file]{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
  .thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;max-height:170px;overflow-y:auto}
  .thumb{position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;background:#e2e8f0}
  .thumb img{width:100%;height:100%;object-fit:cover}
  .thumb .rm{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);color:#fff;border:0;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:1}
  .thumb .sz{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:10px;text-align:center;padding:2px}
  .thumb.done{outline:3px solid #10b981}
  .thumb.err{outline:3px solid #ef4444}
  button.primary{width:100%;margin-top:12px;padding:10px;background:#1a4f8a;color:#fff;border:0;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}
  button.primary:disabled{background:#94a3b8;cursor:not-allowed}
  .bar{height:6px;background:#e2e8f0;border-radius:3px;margin-top:10px;overflow:hidden;display:none}
  .bar>div{height:100%;background:#1a4f8a;width:0;transition:width .2s}
  .log{margin-top:10px;font-size:12px;max-height:110px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:6px;display:none}
  .log.on{display:block}
  .log .ok{color:#065f46}.log .er{color:#991b1b}
  a{color:#1a4f8a}
  .row{margin-bottom:10px}
  .lab{display:block;font-size:11px;font-weight:600;color:#334155;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
  select, .coord-inputs input{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;background:#fff;box-sizing:border-box}
  .coord-inputs{display:grid;grid-template-columns:1fr 1fr auto;gap:6px}
  .ghost{background:#fff;border:1px solid #1a4f8a;color:#1a4f8a;padding:8px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
  .ghost:hover{background:#eff6ff}
  .hint{font-size:11px;color:#64748b;margin-top:4px;min-height:14px}
  .hint.ok{color:#065f46}.hint.er{color:#991b1b}
</style></head><body>
<h3>&#128444; Upload images</h3>
<div class="meta" id="meta"></div>
<div class="row">
  <label class="lab">Save to subfolder</label>
  <select id="subfolder">
    <option value="Raw Photos" selected>Raw Photos</option>
    <option value="After Activity Report">After Activity Report</option>
    <option value="Testimonials">Testimonials</option>
    <option value="Supporting Documents">Supporting Documents</option>
  </select>
</div>
<div class="row coords">
  <label class="lab">Coordinates (for Mapbox)</label>
  <div class="coord-inputs">
    <input id="lat" type="number" step="any" placeholder="Latitude" value="__LAT__">
    <input id="lng" type="number" step="any" placeholder="Longitude" value="__LNG__">
    <button id="saveCoords" type="button" class="ghost">Save coords</button>
  </div>
  <div id="coordStatus" class="hint"></div>
</div>
<label id="drop" class="drop" for="file">
  <p><b>Drag &amp; drop images here</b></p>
  <p style="color:#64748b">or <u>click to browse</u> &mdash; JPG/PNG/GIF &mdash; auto-compressed to max 1600px</p>
  <input id="file" type="file" multiple accept="image/*">
</label>
<div id="thumbs" class="thumbs"></div>
<button id="go" class="primary" disabled>Upload 0 image(s)</button>
<div class="bar" id="bar"><div id="fill"></div></div>
<div class="log" id="log"></div>
<script>
(function(){
  var CFG = { sheet: "__SHEET__", row: __ROW__, title: "__TITLE__", drive: "__DRIVE__" };
  var meta = document.getElementById("meta");
  meta.innerHTML = "<b>" + CFG.title + "</b><br>Sheet: " + CFG.sheet + " &middot; Row " + CFG.row
                 + ' &middot; <a href="' + CFG.drive + '" target="_blank">open Drive folder</a>';

  var MAX = 1600, Q = 0.82, files = [];
  var drop = document.getElementById("drop");
  var fi   = document.getElementById("file");
  var thumbs = document.getElementById("thumbs");
  var go   = document.getElementById("go");
  var bar  = document.getElementById("bar");
  var fill = document.getElementById("fill");
  var log  = document.getElementById("log");
  var subfolderSel = document.getElementById("subfolder");
  var latEl = document.getElementById("lat");
  var lngEl = document.getElementById("lng");
  var coordStatus = document.getElementById("coordStatus");
  var saveCoordsBtn = document.getElementById("saveCoords");

  saveCoordsBtn.addEventListener("click", function() {
    var lat = latEl.value.trim(), lng = lngEl.value.trim();
    if (lat === "" && lng === "") {
      coordStatus.className = "hint";
      coordStatus.textContent = "Cleared.";
    } else if (!lat || !lng) {
      coordStatus.className = "hint er";
      coordStatus.textContent = "Enter both latitude and longitude.";
      return;
    }
    saveCoordsBtn.disabled = true;
    coordStatus.className = "hint";
    coordStatus.textContent = "Saving...";
    google.script.run
      .withSuccessHandler(function(res){
        saveCoordsBtn.disabled = false;
        if (res && res.ok) {
          coordStatus.className = "hint ok";
          coordStatus.textContent = res.coords
            ? "Saved " + res.coords.lat + ", " + res.coords.lng + " to sheet."
            : "Cleared coordinates on sheet.";
        } else {
          coordStatus.className = "hint er";
          coordStatus.textContent = (res && res.error) || "Save failed.";
        }
      })
      .withFailureHandler(function(e){
        saveCoordsBtn.disabled = false;
        coordStatus.className = "hint er";
        coordStatus.textContent = String(e);
      })
      .saveRowCoordinates(CFG.sheet, CFG.row, lat, lng);
  });

  function logLine(msg, cls) {
    log.className = "log on";
    var s = document.createElement("div");
    s.className = cls || "";
    s.textContent = msg;
    log.appendChild(s);
    log.scrollTop = log.scrollHeight;
  }

  // Prevent the page-level default (which opens dropped images in a new tab).
  ["dragenter","dragover","dragleave","drop"].forEach(function(ev){
    document.addEventListener(ev, function(e){ e.preventDefault(); }, false);
  });
  drop.addEventListener("dragover",  function(e){ e.preventDefault(); drop.classList.add("hover"); });
  drop.addEventListener("dragleave", function(){ drop.classList.remove("hover"); });
  drop.addEventListener("drop", function(e){
    e.preventDefault();
    drop.classList.remove("hover");
    if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files);
  });
  fi.addEventListener("change", function(e){
    add(e.target.files);
    fi.value = "";
  });

  function add(list){ for (var i = 0; i < list.length; i++) processFile(list[i]); }

  function processFile(file) {
    if (!file.type || file.type.indexOf("image/") !== 0) {
      logLine("Skipped (not image): " + file.name, "er");
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        var dataUrl = c.toDataURL("image/jpeg", Q);
        var base64  = dataUrl.split(",")[1];
        var kb      = Math.round(base64.length * 0.75 / 1024);
        var newName = file.name.replace(/\\.[^.]+$/, "") + ".jpg";
        files.push({ name:newName, type:"image/jpeg", base64:base64, dataUrl:dataUrl, kb:kb, status:"ready" });
        render();
      };
      img.onerror = function(){ logLine("Cannot decode: " + file.name, "er"); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function render() {
    thumbs.innerHTML = "";
    files.forEach(function(f, i) {
      var d = document.createElement("div");
      d.className = "thumb" + (f.status === "done" ? " done" : f.status === "err" ? " err" : "");
      var rm = f.status === "ready"
        ? '<button class="rm" data-i="' + i + '">&times;</button>'
        : '';
      d.innerHTML = '<img src="' + f.dataUrl + '"><div class="sz">' + f.kb + ' KB</div>' + rm;
      thumbs.appendChild(d);
    });
    thumbs.querySelectorAll(".rm").forEach(function(b) {
      b.addEventListener("click", function(ev){
        ev.preventDefault();
        files.splice(+b.dataset.i, 1);
        render();
      });
    });
    var pending = files.filter(function(f){ return f.status === "ready"; }).length;
    go.disabled = pending === 0;
    go.textContent = "Upload " + pending + " image(s)";
  }

  go.addEventListener("click", function() {
    var pending = files.filter(function(f){ return f.status === "ready"; });
    if (!pending.length) return;
    go.disabled = true;
    bar.style.display = "block";
    fill.style.width = "0%";
    var done = 0, ok = 0;

    function step() {
      var next = files.find(function(f){ return f.status === "ready"; });
      if (!next) { finalize(); return; }
      go.textContent = "Uploading " + (done + 1) + "/" + pending.length + "...";
      google.script.run
        .withSuccessHandler(function(res) {
          if (res && res.ok) { next.status = "done"; ok++; logLine("OK  " + next.name, "ok"); }
          else               { next.status = "err";       logLine("ERR " + next.name + ": " + (res && res.error || "unknown"), "er"); }
          done++;
          fill.style.width = (done * 100 / pending.length) + "%";
          render();
          step();
        })
        .withFailureHandler(function(e) {
          next.status = "err";
          done++;
          logLine("ERR " + next.name + ": " + e, "er");
          fill.style.width = (done * 100 / pending.length) + "%";
          render();
          step();
        })
        .uploadOneImageToRow(CFG.sheet, CFG.row, { name:next.name, type:next.type, base64:next.base64 }, subfolderSel.value);
    }

    function finalize() {
      google.script.run
        .withSuccessHandler(function(res) {
          if (res && res.ok) logLine("Folder now contains " + res.total + " image(s). Row AE updated.", "ok");
          else               logLine("Finalize warning: " + (res && res.error || ""), "er");
          go.textContent = ok + " uploaded \u00b7 click to close";
          go.disabled = false;
          go.onclick = function(){ google.script.host.close(); };
        })
        .finalizeImageUpload(CFG.sheet, CFG.row);
    }

    step();
  });
})();
</script></body></html>`;

function refreshAllImagesAllSheets() {
  var ui  = SpreadsheetApp.getUi();
  var r   = ui.alert('Refresh all sheets?', 'This may take a few minutes.', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet(), total = 0;
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    var sht = ss.getSheetByName(name);
    if (!sht) return;
    var last = sht.getLastRow();
    for (var row = 2; row <= last; row++) {
      var dl = sht.getRange(row, C.DRIVE_LINK).getValue();
      var t  = sht.getRange(row, C.ACTIVITY).getValue();
      if (!dl || !t) continue;
      var imgs = getActivityImages(String(dl));
      if (imgs.length > 0) { writeImageUrls(sht, row, imgs); total++; }
    }
  });
  ui.alert('Done. Updated '+total+' activities.');
}

// ================================================================
//  ON EDIT TRIGGER
// ================================================================
function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var name  = sheet.getName();
    var row   = e.range.getRow();
    var col   = e.range.getColumn();
    if (row <= HEADER_ROW) return;
    if (!PROGRAM_SCHEMA[name]) return;

    if (col === C.PROVINCE) {
      var prov = e.value || '';
      sheet.getRange(row, C.LGU).clearContent().clearDataValidations();
      sheet.getRange(row, C.BARANGAY).clearContent().clearDataValidations();
      if (prov && R5[prov]) setDropdownOnCell(sheet, row, C.LGU, Object.keys(R5[prov]));
      autoTimestamp(sheet, row); return;
    }
    if (col === C.LGU) {
      var p = sheet.getRange(row, C.PROVINCE).getValue();
      var l = e.value || '';
      sheet.getRange(row, C.BARANGAY).clearContent().clearDataValidations();
      if (p && l && R5[p] && R5[p][l]) setBarangayDropdown(sheet, row, p, l);
      autoTimestamp(sheet, row); return;
    }
    if (col === C.ACTIVITY) {
      var t = String(e.value||'').trim();
      if (t) createDriveFolder(sheet, row, name, t);
      autoTimestamp(sheet, row);
    }
    if (col === C.DRIVE_LINK) {
      var dl = String(e.value||'').trim();
      if (dl) { var imgs = getActivityImages(dl); if (imgs.length>0) writeImageUrls(sheet,row,imgs); }
      autoTimestamp(sheet, row);
      syncRowToPMS(sheet, row, name); return;
    }
    if (col >= C.PROVINCE && col <= C.STATUS) {
      autoTimestamp(sheet, row);
      syncRowToPMS(sheet, row, name);
      mirrorToActivities(sheet, row, name);
    }
  } catch(err) { Logger.log('onEdit: '+err); }
}

// ================================================================
//  DATE PICKER
// ================================================================
function openDatePicker() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell  = sheet.getActiveCell();
  var row   = cell.getRow(), col = cell.getColumn();
  if (!PROGRAM_SCHEMA[sheet.getName()]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  if (row <= HEADER_ROW) { SpreadsheetApp.getUi().alert('Click on a data row.'); return; }
  if (col !== C.START_DATE && col !== C.END_DATE) { SpreadsheetApp.getUi().alert('Click on Start Date (I) or End Date (J).'); return; }

  var yr  = parseInt(sheet.getRange(row,C.YEAR).getValue()) || new Date().getFullYear();
  var mn  = toMonthNumber(String(sheet.getRange(row,C.MONTH).getValue())) || (new Date().getMonth()+1);
  var min = yr+'-'+pad2(mn)+'-01';
  var max = yr+'-'+pad2(mn)+'-'+pad2(new Date(yr,mn,0).getDate());
  var lbl = col===C.START_DATE?'Start Date':'End Date';
  var ex  = sheet.getRange(row,col).getValue();
  var def = (ex instanceof Date) ? Utilities.formatDate(ex,Session.getScriptTimeZone(),'yyyy-MM-dd') : min;

  var html = '<style>body{font-family:Arial,sans-serif;padding:18px;background:#f8f9fa;}' +
    'h3{color:#1a4f8a;margin:0 0 4px;}' +
    '.sub{font-size:11px;color:#888;margin-bottom:14px;}' +
    'input{width:100%;padding:9px;border:2px solid #1a4f8a;border-radius:6px;font-size:13px;box-sizing:border-box;}' +
    '.row{display:flex;gap:8px;margin-top:14px;}' +
    'button{flex:1;padding:9px;border:none;border-radius:6px;font-size:13px;font-weight:bold;cursor:pointer;}' +
    '.ok{background:#1a4f8a;color:#fff;}.cancel{background:#e0e0e0;color:#333;}' +
    '</style>' +
    '<h3>'+lbl+'</h3>' +
    '<div class="sub">Locked to month '+mn+'/'+yr+'</div>' +
    '<input type="date" id="d" min="'+min+'" max="'+max+'" value="'+def+'">' +
    '<div class="row">' +
    '<button class="cancel" onclick="google.script.host.close()">Cancel</button>' +
    '<button class="ok" onclick="go()">Set Date</button>' +
    '</div>' +
    '<script>function go(){var v=document.getElementById("d").value;if(!v){alert("Pick a date.");return;}' +
    'document.querySelector(".ok").disabled=true;document.querySelector(".ok").textContent="Setting...";' +
    'google.script.run.withSuccessHandler(function(){google.script.host.close();})' +
    '.setDateFromPicker(v,'+row+','+col+');}<\/script>';

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(300).setHeight(190),'Date Picker');
}
function setDateFromPicker(dateStr,row,col){
  var p=dateStr.split('-');
  var d=new Date(+p[0],+p[1]-1,+p[2]);
  SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange(row,col).setValue(d).setNumberFormat('MM/dd/yyyy');
  autoTimestamp(SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(),row);
}

// ================================================================
//  DASHBOARD
// ================================================================
function buildDashboard(ss) {
  var dash = ss.getSheetByName(DASH_SHEET);
  if (!dash) dash = ss.insertSheet(DASH_SHEET, 0);
  dash.clearContents(); dash.clearFormats();
  dash.setTabColor('#1a4f8a');

  dash.getRange('A1:K1').merge()
      .setValue('DICT Region V — Program Management System  v6')
      .setFontSize(16).setFontWeight('bold').setFontColor('#1a4f8a')
      .setHorizontalAlignment('center').setBackground('#e8f4fd');
  dash.setRowHeight(1,48);

  dash.getRange('A2:K2').merge()
      .setValue('Last rebuilt: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy · HH:mm'))
      .setFontSize(10).setFontColor('#666')
      .setHorizontalAlignment('center').setBackground('#f8f9fa');

  // Program summary table headers
  var th = ['Program','Code','Color','Activities','Completed','Ongoing','For Sub.','Cancelled','Total Pax','Images'];
  dash.getRange(3,1,1,th.length).setValues([th])
      .setBackground('#1a4f8a').setFontColor('#fff').setFontWeight('bold')
      .setHorizontalAlignment('center').setFontSize(10);
  dash.setRowHeight(3,36);

  // Main program table EXCLUDES Activities — it's a master aggregate
  // of all the others, so including it here double-counted every
  // metric (e.g. 70 activities showed up as 140 in the TOTALS row).
  var progNames = Object.keys(PROGRAM_SCHEMA).filter(function(n){ return n !== 'Activities'; });
  progNames.forEach(function(name, i) {
    var schema = PROGRAM_SCHEMA[name];
    var row    = 4 + i;
    var sn     = "'"+name+"'";
    var sht    = ss.getSheetByName(name);
    dash.getRange(row,1).setValue(schema.icon+' '+name);
    dash.getRange(row,2).setValue(schema.code);
    dash.getRange(row,3).setBackground(schema.color||'#888').setValue('').setNote(schema.color);
    if (sht) {
      dash.getRange(row,4).setFormula('=IFERROR(COUNTA('+sn+'!F2:F1000),0)');
      dash.getRange(row,5).setFormula('=IFERROR(COUNTIF('+sn+'!AA2:AA1000,"Completed"),0)');
      dash.getRange(row,6).setFormula('=IFERROR(COUNTIF('+sn+'!AA2:AA1000,"Ongoing"),0)');
      dash.getRange(row,7).setFormula('=IFERROR(COUNTIF('+sn+'!AA2:AA1000,"For Submission"),0)');
      dash.getRange(row,8).setFormula('=IFERROR(COUNTIF('+sn+'!AA2:AA1000,"Cancelled"),0)');
      dash.getRange(row,9).setFormula('=IFERROR(SUM('+sn+'!AC2:AC1000),0)');
      dash.getRange(row,10).setFormula('=IFERROR(COUNTIF('+sn+'!AE2:AE1000,"<>"),0)');
    } else {
      for (var c = 4; c <= 10; c++) dash.getRange(row, c).setValue(0);
      dash.getRange(row,1).setNote('Sheet "'+name+'" missing. Run Setup → Build / repair all sheets.').setFontColor('#b91c1c');
    }
    if (dash.getRange(row,1).getFontColor() !== '#b91c1c') {
      dash.getRange(row,1).setFontColor(schema.color||'#000');
    }
    dash.getRange(row,1).setFontWeight('bold');
    dash.setRowHeight(row,28);
    if (i%2===0) dash.getRange(row,1,1,10).setBackground('#f8f9fa');
  });

  var lastRow = 3 + progNames.length;
  var totRow  = lastRow + 1;
  dash.getRange(totRow,1,1,3).merge().setValue('TOTALS (programs only)').setFontWeight('bold').setBackground('#e8f4fd');
  [4,5,6,7,8,9,10].forEach(function(c){
    dash.getRange(totRow,c).setFormula('=IFERROR(SUM('+colLetter(c)+'4:'+colLetter(c)+lastRow+'),0)').setFontWeight('bold').setBackground('#e8f4fd');
  });

  // ── Activities Master Aggregate (separate card) ──────────────────
  var actRow = totRow + 2;
  var actSheetExists = ss.getSheetByName('Activities');
  dash.getRange(actRow,1,1,3).merge()
      .setValue('📚 Activities Master Aggregate')
      .setFontWeight('bold').setFontColor('#fff').setBackground('#1a4f8a')
      .setHorizontalAlignment('center');
  if (actSheetExists) {
    dash.getRange(actRow,4).setFormula('=IFERROR(COUNTA(Activities!F2:F1000),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,5).setFormula('=IFERROR(COUNTIF(Activities!AA2:AA1000,"Completed"),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,6).setFormula('=IFERROR(COUNTIF(Activities!AA2:AA1000,"Ongoing"),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,7).setFormula('=IFERROR(COUNTIF(Activities!AA2:AA1000,"For Submission"),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,8).setFormula('=IFERROR(COUNTIF(Activities!AA2:AA1000,"Cancelled"),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,9).setFormula('=IFERROR(SUM(Activities!AC2:AC1000),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,10).setFormula('=IFERROR(COUNTIF(Activities!AE2:AE1000,"<>"),0)').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(actRow,1).setNote('Should match the TOTALS row above once mirroring is complete. If different, run Sync → Rebuild Activities master.');
  } else {
    dash.getRange(actRow,4,1,7).setValue('— run Setup first —').setFontColor('#b91c1c');
  }

  // Province breakdown — only populated when the Activities sheet exists.
  var actSht = ss.getSheetByName('Activities');
  var pr = actRow + 2;
  dash.getRange(pr,1,1,6).merge()
      .setValue('Province Breakdown' + (actSht ? ' (Activities Sheet)' : ' — Activities sheet missing'))
      .setFontSize(12).setFontWeight('bold')
      .setFontColor(actSht ? '#1a4f8a' : '#b91c1c');
  pr++;

  if (!actSht) {
    dash.getRange(pr,1,1,6).merge()
        .setValue('Run Setup → Build / repair all sheets, then Sync → Rebuild Activities master to enable these tables.')
        .setFontColor('#666').setFontStyle('italic');
  } else {
    dash.getRange(pr,1,1,6).setValues([['Province','Activities','Completed','Ongoing','For Submission','Total Pax']])
        .setBackground('#2e7d6e').setFontColor('#fff').setFontWeight('bold');
    pr++;
    Object.keys(R5).forEach(function(prov) {
      dash.getRange(pr,1).setValue(prov);
      dash.getRange(pr,2).setFormula('=IFERROR(COUNTIF(Activities!A:A,"'+prov+'"),0)');
      dash.getRange(pr,3).setFormula('=IFERROR(COUNTIFS(Activities!A:A,"'+prov+'",Activities!AA:AA,"Completed"),0)');
      dash.getRange(pr,4).setFormula('=IFERROR(COUNTIFS(Activities!A:A,"'+prov+'",Activities!AA:AA,"Ongoing"),0)');
      dash.getRange(pr,5).setFormula('=IFERROR(COUNTIFS(Activities!A:A,"'+prov+'",Activities!AA:AA,"For Submission"),0)');
      dash.getRange(pr,6).setFormula('=IFERROR(SUMIF(Activities!A:A,"'+prov+'",Activities!AC:AC),0)');
      pr++;
    });

    // ── Mode of Conduct ─────────────────────────────────────
    pr += 2;
    dash.getRange(pr,1,1,6).merge().setValue('Mode of Conduct')
        .setFontSize(12).setFontWeight('bold').setFontColor('#1a4f8a');
    pr++;
    dash.getRange(pr,1,1,3).setValues([['Mode','Activities','% of Total']])
        .setBackground('#2e7d6e').setFontColor('#fff').setFontWeight('bold');
    pr++;
    MODES.forEach(function(m) {
      dash.getRange(pr,1).setValue(m);
      // Mode of Conduct is column K on every sheet (col 11).
      dash.getRange(pr,2).setFormula('=IFERROR(COUNTIF(Activities!K:K,"'+m+'"),0)');
      dash.getRange(pr,3).setFormula('=IFERROR(B'+pr+'/COUNTA(Activities!F2:F1000),0)')
          .setNumberFormat('0.0%');
      pr++;
    });

    // ── Activities by Month ─────────────────────────────────
    pr += 2;
    dash.getRange(pr,1,1,6).merge().setValue('Activities by Month')
        .setFontSize(12).setFontWeight('bold').setFontColor('#1a4f8a');
    pr++;
    dash.getRange(pr,1,1,4).setValues([['Month','Activities','Completed','Total Pax']])
        .setBackground('#2e7d6e').setFontColor('#fff').setFontWeight('bold');
    pr++;
    MONTHS.forEach(function(m) {
      dash.getRange(pr,1).setValue(m);
      dash.getRange(pr,2).setFormula('=IFERROR(COUNTIF(Activities!E:E,"'+m+'"),0)');
      dash.getRange(pr,3).setFormula('=IFERROR(COUNTIFS(Activities!E:E,"'+m+'",Activities!AA:AA,"Completed"),0)');
      dash.getRange(pr,4).setFormula('=IFERROR(SUMIF(Activities!E:E,"'+m+'",Activities!AC:AC),0)');
      pr++;
    });

    // ── Participants Breakdown ──────────────────────────────
    pr += 2;
    dash.getRange(pr,1,1,6).merge().setValue('Participants Breakdown (from Activities master)')
        .setFontSize(12).setFontWeight('bold').setFontColor('#1a4f8a');
    pr++;
    dash.getRange(pr,1,1,4).setValues([['Category','Male','Female','Total']])
        .setBackground('#2e7d6e').setFontColor('#fff').setFontWeight('bold');
    pr++;
    // M=13,N=14 NGA | O=15,P=16 LGU | Q=17,R=18 SUC | S=19,T=20 Others
    var partCats = [['NGA','M','N'],['LGU','O','P'],['SUC','Q','R'],['Others','S','T']];
    partCats.forEach(function(cat) {
      dash.getRange(pr,1).setValue(cat[0]);
      dash.getRange(pr,2).setFormula('=IFERROR(SUM(Activities!'+cat[1]+'2:'+cat[1]+'1000),0)');
      dash.getRange(pr,3).setFormula('=IFERROR(SUM(Activities!'+cat[2]+'2:'+cat[2]+'1000),0)');
      dash.getRange(pr,4).setFormula('=B'+pr+'+C'+pr).setFontWeight('bold');
      pr++;
    });
    dash.getRange(pr,1).setValue('GRAND TOTAL').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(pr,2).setFormula('=SUM(B'+(pr-4)+':B'+(pr-1)+')').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(pr,3).setFormula('=SUM(C'+(pr-4)+':C'+(pr-1)+')').setFontWeight('bold').setBackground('#e8f4fd');
    dash.getRange(pr,4).setFormula('=B'+pr+'+C'+pr).setFontWeight('bold').setBackground('#e8f4fd');
  }

  var dw=[180,70,60,90,90,75,75,80,100,80];
  dw.forEach(function(w,i){ dash.setColumnWidth(i+1,w); });
}

function refreshDashboard() {
  buildDashboard(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert('Dashboard refreshed.');
}

// ================================================================
//  REFERENCE SHEET (for cascading dropdowns)
// ================================================================
function buildReferenceSheet(ss) {
  var ref = ss.getSheetByName(REF_SHEET);
  if (!ref) ref = ss.insertSheet(REF_SHEET);
  ref.clearContents();
  var rows=[];
  Object.keys(R5).forEach(function(p){
    Object.keys(R5[p]).forEach(function(l){
      rows.push([p,l,R5[p][l].join(',')]);
    });
  });
  ref.getRange(1,1,rows.length,3).setValues(rows);
  ref.hideSheet();
}

// ================================================================
//  DRIVE FOLDER CREATION
// ================================================================
function createDriveFolder(sheet, row, sheetName, activityTitle) {
  try {
    var schema = PROGRAM_SCHEMA[sheetName];
    if (!schema) return;
    // Resolve parent folder: prefer schema.driveId, otherwise use a
    // per-spreadsheet auto-provisioned parent — this makes image
    // upload work out-of-the-box without manual Drive-ID setup.
    var parent;
    if (schema.driveId) {
      parent = DriveApp.getFolderById(schema.driveId);
    } else {
      parent = getOrCreateProgramFolder(sheetName);
    }
    var safeName = activityTitle.replace(/[\/\\?%*:|"<>]/g,'-').substring(0,100);
    var found    = parent.getFoldersByName(safeName);
    var folder   = found.hasNext() ? found.next() : parent.createFolder(safeName);
    if (!found.hasNext()) {
      folder.createFolder('After Activity Report');
      folder.createFolder('Raw Photos');
      folder.createFolder('Testimonials');
      folder.createFolder('Supporting Documents');
    }
    sheet.getRange(row,C.DRIVE_LINK).setValue(folder.getUrl());
    var imgs = getActivityImages(folder.getUrl());
    if (imgs.length>0) writeImageUrls(sheet,row,imgs);
  } catch(e) { Logger.log('createDriveFolder: '+e); }
}

// Lazy-creates (and caches in script properties) a parent Drive folder
// for the given program. Used when schema.driveId isn't configured so
// image upload + folder creation always have somewhere to land.
function getOrCreateProgramFolder(programName) {
  var props = PropertiesService.getDocumentProperties();
  var key   = 'DRIVE_PARENT_' + programName;
  var cached = props.getProperty(key);
  if (cached) {
    try { return DriveApp.getFolderById(cached); } catch(e) { /* stale, fall through */ }
  }
  // Root: "DICT R5 Activity Files" at Drive root.
  var rootKey = 'DRIVE_ROOT';
  var rootId  = props.getProperty(rootKey);
  var root;
  if (rootId) {
    try { root = DriveApp.getFolderById(rootId); } catch(e) { root = null; }
  }
  if (!root) {
    var match = DriveApp.getRootFolder().getFoldersByName('DICT R5 Activity Files');
    root = match.hasNext() ? match.next() : DriveApp.getRootFolder().createFolder('DICT R5 Activity Files');
    props.setProperty(rootKey, root.getId());
  }
  var progMatch = root.getFoldersByName(programName);
  var prog = progMatch.hasNext() ? progMatch.next() : root.createFolder(programName);
  props.setProperty(key, prog.getId());
  return prog;
}

// Set driveId per program (call after setup)
function setDriveIds() {
  // Fill these in manually or call setDriveId(sheetName, driveUrl) from the editor
  SpreadsheetApp.getUi().alert(
    'To enable Drive folder auto-creation:\n\n' +
    'In the script editor, add each program\'s Drive folder ID to\n' +
    'PROGRAM_SCHEMA[\'eGovPH\'].driveId = \'YOUR_FOLDER_ID\';\n\n' +
    'Get the ID from the folder URL:\n' +
    'drive.google.com/drive/folders/[THIS_PART_IS_THE_ID]'
  );
}

// ================================================================
//  WEBHOOK SYNC
// ================================================================
function syncRowToPMS(sheet, rowNum, sheetName) {
  try {
    var schema  = PROGRAM_SCHEMA[sheetName];
    var row     = sheet.getRange(rowNum, 1, 1, 31).getValues()[0];
    var sDate   = formatDate(row[C.START_DATE-1]);
    var dlLink  = String(row[C.DRIVE_LINK-1]||'').trim();
    var imgs    = getActivityImages(dlLink);
    if (imgs.length>0) sheet.getRange(rowNum,C.IMAGE_URLS).setValue(imgs.join('\n'));
    var stored  = String(row[C.IMAGE_URLS-1]||'').trim();
    var allImgs = stored ? stored.split('\n').filter(function(u){return u.trim();}) : imgs;

    // Gather extra fields
    var extraData = {};
    if (schema) {
      schema.extraFields.forEach(function(f,i){
        extraData[f.key] = sheet.getRange(rowNum,32+i).getValue();
      });
    }

    var payload = {
      rowNumber:            rowNum,
      projectCode:          schema ? schema.code : sheetName,
      province:             String(row[C.PROVINCE-1]||'').trim(),
      lgu:                  String(row[C.LGU-1]||'').trim(),
      barangay:             String(row[C.BARANGAY-1]||'').trim(),
      activityTitle:        String(row[C.ACTIVITY-1]||'').trim(),
      venue:                String(row[C.VENUE-1]||'').trim(),
      partnerOrganizations: String(row[C.PARTNERS-1]||'').trim(),
      startDate:            sDate,
      endDate:              formatDate(row[C.END_DATE-1])||sDate,
      month:                toMonthNumber(String(row[C.MONTH-1]||'')),
      year:                 parseInt(row[C.YEAR-1])||2025,
      modeOfConduct:        String(row[C.MODE-1]||'Face-to-Face').trim(),
      personnelRaw:         String(row[C.PERSONNEL-1]||'').trim(),
      ngaMale:              toNum(row[C.NGA_M-1]),   ngaFemale:  toNum(row[C.NGA_F-1]),
      lguMale:              toNum(row[C.LGU_M-1]),   lguFemale:  toNum(row[C.LGU_F-1]),
      sucMale:              toNum(row[C.SUC_M-1]),   sucFemale:  toNum(row[C.SUC_F-1]),
      othersMale:           toNum(row[C.OTH_M-1]),   othersFemale: toNum(row[C.OTH_F-1]),
      othersLabel:          String(row[C.OTH_LABEL-1]||'Others').trim(),
      afterActivityReport:  String(row[C.AAR-1]||'').trim(),
      fbPostingLink:        String(row[C.FB_LINK-1]||'').trim(),
      rawPhotosLink:        String(row[C.PHOTOS_LINK-1]||'').trim(),
      testimonialsLink:     String(row[C.TESTI_LINK-1]||'').trim(),
      remarks:              String(row[C.REMARKS-1]||'').trim(),
      status:               String(row[C.STATUS-1]||'').trim(),
      driveFolderLink:      dlLink,
      images:               allImgs,
      extraFields:          extraData
    };

    if (!payload.activityTitle) return;
    UrlFetchApp.fetch(WEBHOOK.URL,{
      method:'POST',contentType:'application/json',
      headers:{'X-Webhook-Secret':WEBHOOK.SECRET,'X-Sheet-Id':WEBHOOK.SHEET_ID},
      payload:JSON.stringify(payload),muteHttpExceptions:true
    });
  } catch(e){ Logger.log('syncRowToPMS: '+e); }
}

function syncAllRows() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  var last=sheet.getLastRow(), count=0;
  for (var r=2;r<=last;r++) {
    if (sheet.getRange(r,C.ACTIVITY).getValue()) { syncRowToPMS(sheet,r,name); count++; }
  }
  SpreadsheetApp.getUi().alert('Synced '+count+' rows.');
}

// ================================================================
//  FAKE DATA
// ================================================================
var FAKE_TITLES = {
  'eGovPH':['eGov PH App Orientation','eGov PH Roll-out Training','eGovernance Awareness Campaign','eGov Services Enrollment Drive'],
  'eLGU':['eLGU System Orientation','LGU Digital Transformation Workshop','eLGU Helpdesk Training','Local e-Governance Forum'],
  'Free WiFi':['Free WiFi Site Assessment','Free WiFi Installation Turnover','FWFiA Signal Quality Audit','Free WiFi Stakeholder Consultation'],
  'GovNet':['GovNet Connectivity Assessment','Government Network Forum','GovNet Site Survey','GovNet Troubleshooting Training'],
  'NBP':['NBP Site Assessment','National Broadband Plan Orientation','NBP Stakeholder Consultation','Broadband Connectivity Forum'],
  'Cybersecurity':['Cybersecurity Awareness Seminar','Data Privacy Act Orientation','Ethical Hacking Workshop','Digital Safety Forum'],
  'PNPKI':['PNPKI Certificate Issuance Drive','Digital Signature Orientation','PKI Enrollment Assistance','PNPKI System Orientation'],
  'DRRM':['ICT for DRRM Training','DRRM Technology Orientation','Early Warning System Demo','Digital Tools for DRRM Workshop'],
  'ILCDB':['I-Learn Center Capacity Building','Digital Skills Workshop','Community ICT Literacy Program','ILCDB Trainer Training'],
  'IIDB':['IIDB Data Collection Workshop','Industry Innovation Training','Innovation Hub Orientation','Digital Innovation Forum for MSMEs'],
  'Activities':['Regional ICT Forum Region V','Multi-Program Capability Building','ICT Summit Bicol 2025','DICT R5 Program Review']
};

function generateFakeDataCurrentSheet(){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name=sheet.getName();
  if(!PROGRAM_SCHEMA[name]){SpreadsheetApp.getUi().alert('Not a program sheet.');return;}
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('Generate Sample Data','How many rows? (1-20):',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var count=Math.min(Math.max(parseInt(r.getResponseText())||5,1),20);
  insertFakeRows(sheet,name,count);
  ui.alert('Generated '+count+' rows in "'+name+'".');
}

function generateFakeDataAllSheets(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('Generate Sample Data — All Sheets','Rows per sheet? (1-10):',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var count=Math.min(Math.max(parseInt(r.getResponseText())||3,1),10);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(PROGRAM_SCHEMA).forEach(function(name){
    var sht=ss.getSheetByName(name);
    if(sht) insertFakeRows(sht,name,count);
  });
  ui.alert('Done! Generated '+count+' rows per sheet.');
}

function insertFakeRows(sheet, name, count) {
  var schema   = PROGRAM_SCHEMA[name];
  if (!schema) {
    SpreadsheetApp.getUi().alert('"'+name+'" has no PROGRAM_SCHEMA entry — cannot generate fake data.');
    return 0;
  }
  // Ensure extra-field headers are present before we write extra values
  // (fixes cases where ILCDB / others lost their Sub-Program etc. columns).
  enforceExtraFieldHeaders(sheet, name);
  var titles   = FAKE_TITLES[name] || FAKE_TITLES['Activities'] || ['Sample Activity'];
  var provs    = Object.keys(R5);
  var venues   = ['Municipal Hall','City Hall','Barangay Hall','State University ICT Center','DICT Regional Office'];
  var partners = ['DTI Albay','TESDA Region V','DepEd Division Office','DOST Region V','Local Mayor\'s Office'];
  var names    = ['Maria Santos','Juan Dela Cruz','Carlo Bautista','Ana Reyes','Jose Mendoza'];
  var statuses = ['Completed','Completed','Completed','Ongoing','For Submission'];
  var startRow = Math.max(sheet.getLastRow()+1,2);

  for(var i=0;i<count;i++){
    var row=startRow+i;
    var prov=provs[Math.floor(Math.random()*provs.length)];
    var lgus=Object.keys(R5[prov]);
    var lgu=lgus[Math.floor(Math.random()*lgus.length)];
    var brgy=R5[prov][lgu][Math.floor(Math.random()*R5[prov][lgu].length)];
    var mn=Math.floor(Math.random()*12)+1;
    var dy=Math.floor(Math.random()*25)+1;
    var sd=new Date(2025,mn-1,dy), ed=new Date(2025,mn-1,dy+Math.floor(Math.random()*2));
    var st=statuses[Math.floor(Math.random()*statuses.length)];

    var base=new Array(31).fill('');
    base[C.PROVINCE-1]=prov; base[C.LGU-1]=lgu; base[C.BARANGAY-1]=brgy;
    base[C.YEAR-1]=2025; base[C.MONTH-1]=MONTHS[mn-1];
    base[C.ACTIVITY-1]=titles[Math.floor(Math.random()*titles.length)];
    base[C.VENUE-1]=lgu+' '+venues[Math.floor(Math.random()*venues.length)];
    base[C.PARTNERS-1]=partners[Math.floor(Math.random()*partners.length)];
    base[C.START_DATE-1]=sd; base[C.END_DATE-1]=ed;
    base[C.MODE-1]=(schema.modes||MODES)[0];
    base[C.PERSONNEL-1]=names[Math.floor(Math.random()*names.length)];
    base[C.NGA_M-1]=Math.floor(Math.random()*6); base[C.NGA_F-1]=Math.floor(Math.random()*6);
    base[C.LGU_M-1]=Math.floor(Math.random()*10); base[C.LGU_F-1]=Math.floor(Math.random()*10);
    base[C.OTH_M-1]=Math.floor(Math.random()*20); base[C.OTH_F-1]=Math.floor(Math.random()*20);
    base[C.OTH_LABEL-1]='Community Residents';
    base[C.AAR-1]=st==='Completed'?'Submitted':'For Submission';
    base[C.STATUS-1]=st; base[C.LAST_UPDATED-1]=new Date(); base[C.IMAGE_URLS-1]='';

    sheet.getRange(row,1,1,31).setValues([base]);
    sheet.getRange(row,C.START_DATE).setNumberFormat('MM/dd/yyyy');
    sheet.getRange(row,C.END_DATE).setNumberFormat('MM/dd/yyyy');
    sheet.getRange(row,C.LAST_UPDATED).setNumberFormat('MM/dd/yyyy HH:mm');
    sheet.getRange(row,C.TOTAL_PAX).setFormula('=IF(COUNTA(M'+row+':T'+row+')=0,"",SUM(M'+row+':T'+row+'))');

    // Fake extra fields
    schema.extraFields.forEach(function(f,fi){
      var val='';
      if(f.type==='number') val=Math.floor(Math.random()*100);
      else if(f.type==='select'&&f.options) val=f.options[Math.floor(Math.random()*f.options.length)];
      else val='Sample '+f.label;
      sheet.getRange(row,32+fi).setValue(val);
    });

    if(R5[prov]) setDropdownOnCell(sheet,row,C.LGU,Object.keys(R5[prov]));
    if(R5[prov]&&R5[prov][lgu]) setBarangayDropdown(sheet,row,prov,lgu);

    // Native Coordinates column — jitter around each province centroid
    // so map pins spread realistically across Region V.
    var centroid = PROV_CENTROIDS[prov];
    if (centroid) {
      var jLat = centroid.lat + (Math.random() - 0.5) * 0.20;
      var jLng = centroid.lng + (Math.random() - 0.5) * 0.20;
      setRowCoordinates(sheet, row, name, jLat.toFixed(5), jLng.toFixed(5));
    }

    try { mirrorToActivities(sheet, row, name); } catch(e) { Logger.log('mirror err: '+e); }
  }
  return count;
}

// Rough province centroids (Region V) used for fake-data coordinates
// and as fallbacks when a row has no explicit lat/lng yet.
var PROV_CENTROIDS = {
  'Albay':              { lat: 13.1391, lng: 123.7438 },
  'Camarines Norte':    { lat: 14.1391, lng: 122.7633 },
  'Camarines Sur':      { lat: 13.6252, lng: 123.1945 },
  'Catanduanes':        { lat: 13.7089, lng: 124.2422 },
  'Masbate':            { lat: 12.3686, lng: 123.6417 },
  'Sorsogon':           { lat: 12.9741, lng: 124.0058 }
};

// Writes / re-writes the per-program extra-field header cells on row 1.
// Run automatically by insertFakeRows, setupProgramSheet and the
// repair tools so columns 32+ always carry the correct labels.
function enforceExtraFieldHeaders(sheet, name) {
  var schema = PROGRAM_SCHEMA[name];
  if (!schema || !schema.extraFields || !schema.extraFields.length) return;
  var labels = schema.extraFields.map(function(f){ return f.label; });
  sheet.getRange(1, 32, 1, labels.length)
       .setValues([labels])
       .setBackground('#0f172a').setFontColor('#ffd700').setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle');
}

// Scans the current sheet for rows that have an Activity Title but
// are missing Status / Pax and fills them with safe defaults so they
// stop showing as "orphan" zeros on the dashboard. Preserves any
// data that's already there.
// Aggressive variant: fills every empty column on rows that have a
// title, including Personnel / Pax / Others Label / per-program
// extra-fields. Pax values are small random integers so Total Pax
// and dashboard counts become non-zero.
function fillMissingFields() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name  = sheet.getName();
  if (!PROGRAM_SCHEMA[name]) { SpreadsheetApp.getUi().alert('Not a program sheet.'); return; }
  _fillMissingFieldsOn(sheet, name, /*verbose=*/true);
}

function _fillMissingFieldsOn(sheet, name, verbose) {
  var last = sheet.getLastRow();
  if (last < 2) { if (verbose) SpreadsheetApp.getUi().alert('Nothing to fill.'); return 0; }
  var schema = PROGRAM_SCHEMA[name];
  enforceExtraFieldHeaders(sheet, name);

  var data = sheet.getRange(2, 1, last - 1, 31).getValues();
  var extraCount = (schema.extraFields||[]).length;
  var extras = extraCount ? sheet.getRange(2, 32, last - 1, extraCount).getValues() : null;

  var names    = ['Maria Santos','Juan Dela Cruz','Carlo Bautista','Ana Reyes','Jose Mendoza'];
  var modes    = schema.modes || MODES;
  var fixed = 0;

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!String(r[C.ACTIVITY-1]||'').trim()) continue;
    var changed = false;

    // Core enums
    if (!String(r[C.STATUS-1]||'').trim()) { r[C.STATUS-1] = 'For Submission'; changed = true; }
    if (!String(r[C.MODE-1]||'').trim())   { r[C.MODE-1]   = modes[0]; changed = true; }
    if (!String(r[C.AAR-1]||'').trim())    { r[C.AAR-1]    = 'For Submission'; changed = true; }
    if (!String(r[C.PERSONNEL-1]||'').trim()) { r[C.PERSONNEL-1] = names[i % names.length]; changed = true; }
    if (!String(r[C.OTH_LABEL-1]||'').trim()) { r[C.OTH_LABEL-1] = 'Community Residents'; changed = true; }

    // Pax — only randomize if the entire row of pax cells is empty,
    // otherwise respect whatever the user already typed.
    var paxCols = [C.NGA_M, C.NGA_F, C.LGU_M, C.LGU_F, C.SUC_M, C.SUC_F, C.OTH_M, C.OTH_F];
    var anyPax = paxCols.some(function(c){ return String(r[c-1]||'').trim() !== ''; });
    if (!anyPax) {
      r[C.NGA_M-1] = Math.floor(Math.random()*6);
      r[C.NGA_F-1] = Math.floor(Math.random()*6);
      r[C.LGU_M-1] = Math.floor(Math.random()*10);
      r[C.LGU_F-1] = Math.floor(Math.random()*10);
      r[C.OTH_M-1] = Math.floor(Math.random()*15);
      r[C.OTH_F-1] = Math.floor(Math.random()*15);
      changed = true;
    }

    if (!r[C.LAST_UPDATED-1]) { r[C.LAST_UPDATED-1] = new Date(); changed = true; }

    // Per-program extra fields
    if (extras) {
      (schema.extraFields||[]).forEach(function(f, fi) {
        if (String(extras[i][fi]||'').trim() !== '') return;
        if (f.type === 'number') extras[i][fi] = Math.floor(Math.random()*50) + 5;
        else if (f.type === 'select' && f.options && f.options.length) extras[i][fi] = f.options[0];
        else extras[i][fi] = 'Sample ' + f.label;
        changed = true;
      });
    }

    if (changed) fixed++;
  }

  if (fixed) {
    sheet.getRange(2, 1, data.length, 31).setValues(data);
    if (extras) sheet.getRange(2, 32, data.length, extraCount).setValues(extras);
    sheet.getRange(2, C.LAST_UPDATED, data.length).setNumberFormat('MM/dd/yyyy HH:mm');
    // Re-apply Total Pax formula on any row we touched (in case it was cleared).
    var tp = [];
    for (var j = 0; j < data.length; j++) {
      var rr = j + 2;
      tp.push(['=IF(COUNTA(M'+rr+':T'+rr+')=0,"",SUM(M'+rr+':T'+rr+'))']);
    }
    sheet.getRange(2, C.TOTAL_PAX, data.length, 1).setFormulas(tp);
  }
  if (verbose) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      fixed + ' row(s) completed with default Status / Mode / AAR / Personnel / Pax / extras.',
      '✅ ' + name, 7
    );
  }
  return fixed;
}

// Apply repair-validations across every program sheet (skips Dashboard / Reference).
function repairValidationsAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ran = 0;
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    var sht = ss.getSheetByName(name);
    if (!sht) return;
    ss.setActiveSheet(sht);
    try { repairValidations(); ran++; } catch(e) { Logger.log('repair '+name+': '+e); }
  });
  SpreadsheetApp.getUi().alert('Validations repaired across ' + ran + ' program sheet(s).');
}

// Clean phantom rows across every program sheet (skips Dashboard / Reference).
function cleanPhantomRowsAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ran = 0;
  Object.keys(PROGRAM_SCHEMA).forEach(function(name) {
    var sht = ss.getSheetByName(name);
    if (!sht) return;
    ss.setActiveSheet(sht);
    try { cleanPhantomRows(); ran++; } catch(e) { Logger.log('clean '+name+': '+e); }
  });
  SpreadsheetApp.getUi().alert('Phantom rows cleaned across ' + ran + ' program sheet(s).');
}

// ================================================================
//  CLEAR DATA
// ================================================================
function clearCurrentSheet(){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var name=sheet.getName();
  if(!PROGRAM_SCHEMA[name]){SpreadsheetApp.getUi().alert('Not a program sheet.');return;}
  var ui=SpreadsheetApp.getUi();
  if(ui.alert('Clear "'+name+'"?','All rows will be deleted.',ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  var r=ui.prompt('Type DELETE to confirm:','',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK||r.getResponseText().trim().toUpperCase()!=='DELETE'){ui.alert('Cancelled.');return;}
  var headers=getFullHeaders(name);
  if(sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).clearContent();
  ui.alert('"'+name+'" cleared.');
}

function clearAllSheets(){
  var ui=SpreadsheetApp.getUi();
  if(ui.alert('Clear ALL program sheets?','',ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  var r=ui.prompt('Type DELETE ALL to confirm:','',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK||r.getResponseText().trim().toUpperCase()!=='DELETE ALL'){ui.alert('Cancelled.');return;}
  var ss=SpreadsheetApp.getActiveSpreadsheet(), count=0;
  Object.keys(PROGRAM_SCHEMA).forEach(function(name){
    var sht=ss.getSheetByName(name);
    if(sht&&sht.getLastRow()>1){
      sht.getRange(2,1,sht.getLastRow()-1,getFullHeaders(name).length).clearContent();
      count++;
    }
  });
  ui.alert('Cleared '+count+' sheets.');
}

// ================================================================
//  TRIGGER INSTALL
// ================================================================
function installOnEditTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='onEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}

// ================================================================
//  HELPERS
// ================================================================
function reapplyCurrentRow(){
  var sheet=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row=sheet.getActiveCell().getRow();
  var prov=sheet.getRange(row,C.PROVINCE).getValue();
  var lgu=sheet.getRange(row,C.LGU).getValue();
  if(prov&&R5[prov]) setDropdownOnCell(sheet,row,C.LGU,Object.keys(R5[prov]));
  if(prov&&lgu&&R5[prov]&&R5[prov][lgu]) setBarangayDropdown(sheet,row,prov,lgu);
  SpreadsheetApp.getUi().alert('Dropdowns refreshed for row '+row+'.');
}

function testDriveConnection(){
  try{DriveApp.getStorageUsed();SpreadsheetApp.getUi().alert('Drive connection OK.');}
  catch(e){SpreadsheetApp.getUi().alert('Drive error: '+e);}
}

function testWebhook(){
  try{
    var r=UrlFetchApp.fetch(WEBHOOK.URL,{method:'GET',muteHttpExceptions:true});
    SpreadsheetApp.getUi().alert('Status: '+r.getResponseCode()+'\n'+r.getContentText().substring(0,300));
  }catch(e){SpreadsheetApp.getUi().alert('Webhook error: '+e);}
}

// All static dropdowns are flexible (allowInvalid=true) — users get
// a warning icon instead of a blocking "data validation rules" popup
// when they type a value not in the list. This prevents the whole
// class of L21/B504-style save-blocking errors.
function setStaticDropdown(sheet,col,values){
  // 1000-row range (was 500) so rows well past the visible area still
  // get the flexible validation. Prevents L502-style popups when the
  // user types into a row that was never reached by the old setup.
  sheet.getRange(HEADER_ROW+1,col,1000).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(values,true).setAllowInvalid(true).build()
  );
}

// Province / Year / Month / LGU / custom-text cells — flexible so
// typing a value not in the list only shows a warning icon instead
// of blocking the save with a "data validation rules" popup.
function setStaticDropdownFlex(sheet,col,values){
  sheet.getRange(HEADER_ROW+1,col,1000).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(values,true).setAllowInvalid(true).build()
  );
}

// KEY FIX: was setAllowInvalid(false) — the cause of the popup.
function setDropdownOnCell(sheet,row,col,values){
  sheet.getRange(row,col).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(values,true).setAllowInvalid(true).build()
  );
}

function setBarangayDropdown(sheet,row,province,lgu){
  var list=R5[province][lgu].slice(0,200);
  sheet.getRange(row,C.BARANGAY).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(list,true).setAllowInvalid(true).build()
  );
}

function applyStatusFormatting(sheet){
  var range=sheet.getRange(2,C.STATUS,500);
  var rules=sheet.getConditionalFormatRules();
  [['Completed','#d9ead3','#274e13'],['Ongoing','#fff2cc','#7f6000'],
   ['For Submission','#fce5cd','#783f04'],['Cancelled','#f4cccc','#660000'],
   ['Pending','#e0e0e0','#434343']].forEach(function(m){
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(m[0]).setBackground(m[1]).setFontColor(m[2]).setBold(true)
      .setRanges([range]).build());
  });
  sheet.setConditionalFormatRules(rules);
}

function autoTimestamp(sheet,row){
  sheet.getRange(row,C.LAST_UPDATED).setValue(new Date()).setNumberFormat('MM/dd/yyyy HH:mm');
}
function formatDate(val){
  if(!val) return '';
  if(val instanceof Date) return Utilities.formatDate(val,Session.getScriptTimeZone(),'yyyy-MM-dd');
  return String(val).trim();
}
function toNum(val){ var n=parseFloat(String(val||'0').replace(/,/g,'')); return isNaN(n)?0:Math.round(n); }
function toMonthNumber(val){
  var map={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  var n=parseInt(val,10); if(!isNaN(n)&&n>=1&&n<=12) return n;
  return map[String(val||'').toLowerCase()]||null;
}
function colLetter(col){
  var l='';
  while(col>0){var m=(col-1)%26;l=String.fromCharCode(65+m)+l;col=Math.floor((col-m-1)/26);}
  return l;
}
function pad2(n){ return n<10?'0'+n:''+n; }
function randFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }