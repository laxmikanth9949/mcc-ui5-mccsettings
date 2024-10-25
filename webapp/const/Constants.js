sap.ui.define([],
	function () {
		"use strict";

		var constants = {
			"RoleTypes": {
				"Regional": "R",
				"Product": "P",
				"Global": "G",
				"Regional_Product": "PR",
				"Customer": "C",
				"Service_Team": "ST",
				"MCC_Tag": "Tag",
				"Engagement_Type": "ENGA",
				"Engagement_Type_Region": "ENGAR"
			},
			"Profiles": {
				"mcs-gem": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-gss": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcs-ccm": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-cpc": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcs-ccm-crm": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-cpc-crm": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"initiative-tcm": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"gcs-cem": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-xim": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-spro": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-tf": "R,P,G,PR,C,ST,Tag,ENGA,ENGAR",
				"mcc-ccm-checker": "G,R",
				"mcc-cct": "R,P,G,PR,C,ST",
				"mcc-workplace-bd": "G,R",
				"mcc-workplace-bd-icp": "G,R",
				"mcc-workplace-crossIssue": "G",
				"mcs-ger": "R,P,G,PR,C,ST",
				"mcc-cim": "R,P,G,PR,C,ST",
				"mcc-cec": "R,P,G,PR,C,Tag",
				"mcs-L1ccm": "",
				"mcs-L1ccm-crm": "",
				"unassigned": "",
				"mcc-heat": "R,P,PR,C,G,Tag,ST"
			}
		};

		return constants;
	});
