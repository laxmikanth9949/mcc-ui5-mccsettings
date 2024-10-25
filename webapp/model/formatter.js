sap.ui.define([], function () {
	"use strict";
	var toOrCC = [{
		"key": "To",
		"value": "To"
	}, {
		"key": "CC",
		"value": "CC"
	}];

	var templateTypes = [{
		"key": "N1",
		"value": "Regular Mail with SAP Logo"
	}, {
		"key": "N0",
		"value": "Regular Mail without SAP Logo"
	}, {
		"key": "I1",
		"value": "Invitation with SAP Logo"
	}, {
		"key": "I0",
		"value": "Invitation without SAP Logo"
	}];

	var RoleTypes = [{
		"key": "R",
		"value": "Regional"
	}, {
		"key": "P",
		"value": "Product"
	}, {
		"key": "G",
		"value": "Global"
	}, {
		"key": "PR",
		"value": "Regional Product"
	}, {
		"key": "C",
		"value": "Customer"
	}, {
		"key": "ST",
		"value": "Service Team"
	}, {
		"key": "Tag",
		"value": "MCC Tag"
	}, {
		"key": "ENGA",
		"value": "Engagement Type"
	}, {
		"key": "ENGAR",
		"value": "Regional Engagement Type"
	}];

	var Regions = [{
		"key": "EMEA"
	}, {
		"key": "APJ"
	}, {
		"key": "NA"
	}, {
		"key": "LAC"
	}];

	var Subregions = [{
		"key": "EMEA"
	}, {
		"key": "MEE"
	}, {
		"key": "APJ"
	}, {
		"key": "GTC"
	}, {
		"key": "NA"
	}, {
		"key": "LAC"
	}];

	var Subsubregions = [{
		"key": "EMEA East"
	}, {
		"key": "EMEA North"
	}, {
		"key": "EMEA South"
	}, {
		"key": "South East Asia"
	}, {
		"key": "INDIA"
	}, {
		"key": "ANZ"
	}, {
		"key": "JAPAN"
	}, {
		"key": "SOUTH KOREA"
	}, {
		"key": "BRAZIL"
	}, {
		"key": "MEXICO"
	}, {
		"key": "SOLA"
	}, {
		"key": "NOLA"
	}, {
		"key": "DACH"
	}];

	var Subsubsubregions = [{
		"key": "CIS"
	}, {
		"key": "UKI"
	}, {
		"key": "SEFA"
	}, {
		"key": "AFRICA"
	}, {
		"key": "CEE"
	}, {
		"key": "Nordics"
	}, {
		"key": "FRANCE"
	}, {
		"key": "ITALY"
	}, {
		"key": "ME South"
	}, {
		"key": "ME North"
	}];

	return {

		formatBoolean: function (String) {
			if (String === 'Y') {
				return true;
			} else {
				return false;
			}
		},

		ActiveLabel: function (BooleanActive) {
			if (BooleanActive) {
				return "Success";
			} else {
				return "None";
			}
		},

		calculateVersion: function (isCreate, Roadmapversion) {
			if (isCreate) {
				return this.getModel("settings").getProperty("/latestVersion");
			} else {
				return Roadmapversion;
			}
		},

		ActiveText: function (BooleanActive) {
			if (BooleanActive) {
				return "Active";
			} else {
				return "";
			}
		},

		getTOORCC: function () {
			return toOrCC;
		},
		getRoleTypes: function () {
			return RoleTypes;
		},
		getType: function (key) {
			return RoleTypes[key];
		},

		getRegions: function () {
			return Regions;
		},
		getSubregions: function () {
			return Subregions;
		},
		getSubsubregions: function () {
			return Subsubregions;
		},
		getSubsubsubregions: function () {
			return Subsubsubregions;
		},

		getTemplateTypes: function () {
			return templateTypes;
		},

		getRowColor: function (EventType) {
			if (EventType === 'SAP Production Release') {
				return 'Indication02';
			} else if (EventType === 'SAP Preview Release') {
				return 'Indication05';
			} else if (EventType === 'Migration') {
				return 'Indication08';
			} else if (EventType === 'Business Event') {
				return 'Indication03';
			} else if (EventType === 'Critical Event Coverage') {
				return 'Indication04';
			} else {
				return null;
			}

		},

		getDefaultValueExecutionOrder: function (iValue) {
			if (iValue) {
				return iValue;
			}
			return 1;
		},

		formatTemplateID: function (sId, aTemplates) {
			for (var i = 0; i < aTemplates.length; i++) {
				if (aTemplates[i].TemplateID === sId) {
					return aTemplates[i].TemplateDescription + " (" + aTemplates[i].TemplateType + ")";
				}
			}
			return "";
		},

		formatChangeLogTitle: function (type, changedBy, changedAt) {
			return type + " by " + changedBy + " at " + changedAt;
		},

		formatTemplateName: function (sSearchTerm, aAllTemplates) {
			var aFittingTemplates = [];
			for (var i = 0; i < aAllTemplates.length; i++) {
				if (aAllTemplates[i].TemplateName.toUpperCase().indexOf(sSearchTerm.toUpperCase()) > -1) {
					aFittingTemplates.push(aAllTemplates[i].TemplateID);
				}
			}
			return aFittingTemplates;
		},

		formatMailSelection: function (sValue) {
			var aSelectedTemplates = this.getModel("MailTemplates").getData();
			for (var i = 0; i < aSelectedTemplates.length; i++) {
				if (aSelectedTemplates[i].MailTemplate_TemplateID === sValue) {
					//make sure that selecting was not removed
					for (var a = 0; a < this.aToBeDeleted.length; a++) {
						if (this.aToBeDeleted[a].MailTemplate_TemplateID === sValue) {
							return false;
						}
					}
					return true;
				}
			}
			//add if selection was made before
			for (var b = 0; b < this.aToBeCreated.length; b++) {
				if (this.aToBeCreated[b].MailTemplate_TemplateID === sValue) {
					return true;
				}
			}
			return false;
		},

		formatServiceTeamKey: function (sKey) {
			if (sKey.length === 10) return "Service Team"; //service team
			else return "Assignment Group"; //assign. group
		},
		formatServiceTeamID: function (id, values) {
			if (id) {
				var value = values.filter(el => el.DropdownKey.includes(id));
				if (value.length > 0) return value[0].DropdownValue;
				else return "";
			} else return "";
		},

		getStatusColor: function (Status) {
			if (Status === 'Draft') {
				return 'Warning';
			} else if (Status === 'Published') {
				return 'Success';
			} else {
				return null;
			}
		},

		formatEventContacts: function (sUserId, aNames) {
			var aContacts = [];
			if (sUserId) {
				var aUserId = sUserId.split(",");
				aUserId.forEach(function (id) {
					var bFound = false,
						oContact = {};
					if (aNames) {
						aNames.forEach(function (name) {
							if (id && name.includes(id)) oContact.nameId = name;
							if (id && name.includes(id)) bFound = true;
						});
						if (bFound === false) oContact.nameId = id;
					}
					oContact.userId = id;
					aContacts.push(oContact);
				});
			}
			return aContacts;
		},
		formatEventListContacts: function (sUserId, aNames) {
			var sNames = "";
			if (sUserId && aNames) {
				var aUserId = sUserId.split(",");
				aUserId.forEach(function (id) {
					var bFound = false;
					aNames.every(function (name) {
						if (id && name.includes(id)) {
							sNames += name + ", ";
							bFound = true;
							return false;
						}
						return true;
					});
					if (bFound === false) sNames += id + ", ";
				});
				if (sNames[sNames.length - 2] === ",") sNames = sNames.slice(0, sNames.length - 2);
			} else if (!aNames) {
				sNames = sUserId;
			}
			return sNames;
		},

		formatEventDateTime: function (oDate) {
			if (oDate !== null && oDate !== "" && oDate !== undefined) {
				if (typeof oDate !== "object" && oDate.includes("Z")) return oDate;
				oDate = sap.ui.core.format.DateFormat.getDateTimeInstance({
					//pattern: "MMM dd, YYYY hh:mm a", //	--> issue that 31.12.23 formats to 31.12.24
					style: "medium",
					UTC: true
				}).format(oDate);
			}
			return oDate;
		},
		formatDate: function (oDate) {
			if (oDate !== null && oDate !== "" && oDate !== undefined) {
				oDate = sap.ui.core.format.DateFormat.getDateTimeInstance({
					pattern: "MMM dd, YYYY",
					style: "full"
				}).format(oDate);
			}
			return oDate;
		},
		formatMainProductId: function (productId) {
			var name = this.oView.getModel("viewModel").getProperty("/productName");
			if (name) return name;
			else return productId;
		},

		formatRoadmapRegionBitwise: function (iRegion) {
			var sRegion = "";
			if ((iRegion & 0b10000000) === 0b10000000) {
				sRegion = "All";
			} else if (iRegion === 0b00000001) {
				sRegion = "EMEA";
			} else if (iRegion === 0b00000010) {
				sRegion = "APJ";
			} else if (iRegion === 0b00000100) {
				sRegion = "NA";
			} else if (iRegion === 0b00001000) {
				sRegion = "LAC";
			} else if (iRegion === 0b00010000) {
				sRegion = "Gr. China";
			}
			return sRegion;
		},
		formatRoadmapScenario: function (iScenario) {
			var sScenario = "";
			if (iScenario === 7) {
				sScenario = "1,2,3";
			} else if (iScenario === 6) {
				sScenario = "2,3";
			} else if (iScenario === 4) {
				sScenario = "3";
			} else if (iScenario === 2) {
				sScenario = "2";
			} else if (iScenario === 1) {
				sScenario = "1";
			}
			return sScenario;
		},
		formatLineID: function (ID, values) {
			var name = ID;
			if (ID) {
				values.forEach(function (line) {
					if (line.LineID === ID) name = line.LineName;
				});
			}
			return name;
		},
		formatProductID: function (ID, values) {
			var name = ID;
			if (ID) {
				values.forEach(function (product) {
					if (product.ProductNR === ID) name = product.ProductName;
				});
			}
			return name;
		},

		getVisibility: function (allowedFilterCriteria, sProperty) {
			if (allowedFilterCriteria == null) return false;
			else if (allowedFilterCriteria.includes("sProperty")) return true;
			else return false;

		},

		trimPreZeros: function (sString) {
			if (sString) {
				return sString.replace(/\b(0+)/gi, "");
			}
		},
		checkVisibility: function (value) {
			return value !== '' && value !== null;
		},

		averageFeedback: function (sFeedbackID) {
			const oModel = this.getView().getModel("avgRatingsModel");
			const aRatings = oModel.getProperty("/");

			// Find the relevant scenario from the array using Array's find method
			const ratingObject = aRatings.find(rating => rating.scenarioID_ID === sFeedbackID);

			// If object is found, return the averageRating, otherwise return 0
			return ratingObject ? ratingObject.averageRating : 0;
		},

		flagButtonType: function (bProcessedFlag) {
			return bProcessedFlag ? "Emphasized" : "Transparent";
		},

		flagButtonTooltip: function (bProcessedFlag) {
			return bProcessedFlag ? "Remove Flag" : "Set Flag";
		},

		formatDataID: function (dataID) {
			// Prüfen, ob die dataID eine Zahl ist
			if (/^\d+$/.test(dataID)) {
				// URL für Zahlen (z.B. "10161")
				return "ServiceNow";
			}
			// Prüfen, ob die dataID eine UUID ist
			else if (/^[0-9a-fA-F]{32}$/.test(dataID)) {
				// URL für UUIDs (z.B. "1b168c2ddb014a50034ca8ebd396197a")
				return "MCC One DashBoard";
			}
			// Fallback für ungültige Daten
			else {
				return "Ungültige dataID";
			}
		},

		formatIDURL: function (dataID) {
			// Ermitteln der aktuellen Umgebung (dev, test, prod)
			const sURL = window.location.href;
			let baseUrl;

			if (sURL.includes("prod")) {
				baseUrl = "https://sapit-home-prod-004.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display&/Customer/";
			} else if (sURL.includes("test")) {
				baseUrl = "https://sapit-home-test-004.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display&/Customer/";
			} else {
				baseUrl = "https://sapit-customersupport-dev-mallard.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display&/Customer/";
			}

			if (/^\d+$/.test(dataID)) {
				return baseUrl + dataID;
			}
			else if (/^[0-9a-fA-F]{32}$/.test(dataID)) {
				if (sURL.includes("prod")) {
					return "https://itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/" + dataID;
				} else if (sURL.includes("test")) {
					return "https://test.itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/" + dataID;
				} else {
					return "https://dev.itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/" + dataID;
				}
			}
			else {
				return "Ungültige dataID";
			}
		},

		formatParameterMessage: function (oParameters) {
			const json = JSON.parse(oParameters);
			return json.messages[0].content;
		},

		formatMaxTokens: function (oParameters) {
			const json = JSON.parse(oParameters);
			return json.maxTokens;
		},

		formatTemperatur: function (oParameters) {
			const json = JSON.parse(oParameters);
			return json.temperature;
		},

		formatPresencePenalty: function (oParameters) {
			const json = JSON.parse(oParameters);
			return json.presencePenalty;
		},

		formatFrequencyPenalty: function (oParameters) {
			const json = JSON.parse(oParameters);
			return json.frequencyPenalty;
		},
		formatEditSaveButton: function () {
			return "sap - icon://edit";
		}
	};
});