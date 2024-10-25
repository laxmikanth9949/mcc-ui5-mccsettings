sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	// "sapit/controls/UserSearchDialog",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Filter",
	"mcc/workbench/admin/settings/model/formatter"
], function (BaseController, JSONModel, MessageBox, MessageToast,
	// EmployeeDataSearchDialog,
	FilterOperator, Filter, formatter) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.SolutionHub.Events.CreateEntity", {
		formatter: formatter,
		_oBinding: {},

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			var that = this;
			this.getRouter().getTargets().getTarget("createSolutionHubEvents").attachDisplay(null, this._onDisplay, this);
			this._oODataModel = this.getOwnerComponent().getModel("SolutionHub");
			this._ZS_APP_DEP_Model = this.getOwnerComponent().getModel("ZS_APP_DEP_SRV");
			this._oResourceBundle = this.getResourceBundle();
			this._oViewModel = new JSONModel({
				enableCreate: false,
				delay: 0,
				busy: false,
				mode: "create",
				viewTitle: "",
				productName: "",
				Contacts: [],
				EventTypeDropdownValues: [{
					"Key": "SAP Production Release",
					"Name": "SAP Production Release"
				}, {
					"Key": "SAP Preview Release",
					"Name": "SAP Preview Release"
				}, {
					"Key": "Migration",
					"Name": "Migration"
				}, {
					"Key": "Business Event",
					"Name": "Business Event"
				}, {
					"Key": "Critical Event Coverage",
					"Name": "Critical Event Coverage"
				}, {
					"Key": "Solution Specific Event",
					"Name": "Solution Specific Event"
				}],
				EventSolutionAreaDropdownValues: [{
					"Key": "HXM",
					"Name": "Human Capital Management"
				}, {
					"Key": "CX",
					"Name": "Customer Experience"
				}, {
					"Key": "DSC",
					"Name": "Digital Supply Chain"
				}, {
					"Key": "ISBN",
					"Name": "Intelligent Spend Management"
				}, {
					"Key": "S/4HANA",
					"Name": "S/4HANA"
				}, {
					"Key": "BTP HANA & Analytics",
					"Name": "Business Technology Platform (HANA & Analytics)"
				}, {
					"Key": "BTP Core",
					"Name": "Business Technology Platfrom (Core)"
				}],
				StatusDrodpownValues: [{
					"Key": "Draft",
					"Name": "Draft"
				}, {
					"Key": "Published",
					"Name": "Published"
				}]

			});
			this.setModel(this._oViewModel, "viewModel");
			this.getView().setModel(this._oODataModel);

			// Register the view with the message manager
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
			var oMessagesModel = sap.ui.getCore().getMessageManager().getMessageModel();
			this._oBinding = new sap.ui.model.Binding(oMessagesModel, "/", oMessagesModel.getContext("/"));
			this._oBinding.attachChange(function (oEvent) {
				var aMessages = oEvent.getSource().getModel().getData();
				for (var i = 0; i < aMessages.length; i++) {
					if (aMessages[i].type === "Error" && !aMessages[i].technical) {
						that._oViewModel.setProperty("/enableCreate", false);
					}
				}
			});
		},
		/**
		 * Gets the form fields
		 * @param {sap.ui.layout.form} oSimpleForm the form in the view.
		 * @private
		 */
		_getFormFields: function (oSimpleForm) {
			var aControls = [];
			var aFormContent = oSimpleForm.getContent();
			var sControlType;
			for (var i = 0; i < aFormContent.length; i++) {
				sControlType = aFormContent[i].getMetadata().getName();
				if (sControlType === "sap.m.MultiInput" || sControlType === "sap.m.Input" || sControlType === "sap.m.DateTimePicker" ||
					sControlType === "sap.m.CheckBox") {
					aControls.push({
						control: aFormContent[i],
						required: aFormContent[i - 1].getRequired && aFormContent[i - 1].getRequired()
					});
				}
			}
			return aControls;
		},
		/**
		 * Event handler (attached declaratively) for the view save button. Saves the changes added by the user. 
		 * @function
		 * @public
		 */
		onSave: function () {
			var oModel = this._oODataModel,
				oView = this.getView();

			//we have to convert the dates to UTC, the date picker returns local time
			//example: user picked 12:00:00, the value will be 12:00:00 GMT+1 although the user wanted to select 12:00:00 GMT
			// for example 2022-05-13T07:00:00.000Z
			var startTime = oView.byId("StartDateTime_id").getDateValue();
			var endTime = oView.byId("EndDateTime_id").getDateValue();
			if (startTime) {
				var month = (startTime.getMonth() + 1) > 9 ? startTime.getMonth() + 1 : "0" + (startTime.getMonth() + 1);
				var day = startTime.getDate() > 9 ? startTime.getDate() : "0" + startTime.getDate();
				var hours = startTime.getHours() > 9 ? startTime.getHours() : "0" + startTime.getHours();
				var min = startTime.getMinutes() > 9 ? startTime.getMinutes() : "0" + startTime.getMinutes();
				var UTCstart = startTime.getFullYear() + "-" + month + "-" + day + "T" + hours + ":" + min + ":00.000Z";
				oModel.setProperty(oView.getBindingContext().getPath() + "/StartDateTime", UTCstart);
			}
			if (endTime) {
				month = (endTime.getMonth() + 1) > 9 ? endTime.getMonth() + 1 : "0" + (endTime.getMonth() + 1);
				day = endTime.getDate() > 9 ? endTime.getDate() : "0" + endTime.getDate();
				hours = endTime.getHours() > 9 ? endTime.getHours() : "0" + endTime.getHours();
				min = endTime.getMinutes() > 9 ? endTime.getMinutes() : "0" + endTime.getMinutes();
				var UTCend = endTime.getFullYear() + "-" + month + "-" + day + "T" + hours + ":" + min + ":00.000Z";
				oModel.setProperty(oView.getBindingContext().getPath() + "/EndDateTime", UTCend);
			}

			this._oViewModel.setProperty("/busy", true);
			//	if (this._oViewModel.getProperty("/mode") === "edit") {
			// attach to the request completed event of the batch
			oModel.attachEventOnce("batchRequestCompleted", function (oEvent) {
				if (this._checkIfBatchRequestSucceeded(oEvent)) {
					this._fnUpdateSuccess();
				} else {
					this._fnEntityCreationFailed();
					MessageBox.error(this._oResourceBundle.getText("updateError"));
				}
			}.bind(this));
			/*if (startTime) oModel.setProperty(oView.getObjectBinding().getPath() + "/StartDateTime", UTCstart); //new Date(endTime).toISOString()
				if (endTime) oModel.setProperty(oView.getObjectBinding().getPath() + "/EndDateTime", UTCend);
			} else {
				oModel.setProperty(oView.getBindingContext().getPath() + "/StartDateTime", UTCstart); //new Date(startTime).toISOString()
				oModel.setProperty(oView.getBindingContext().getPath() + "/EndDateTime", UTCend);
			}*/
			if (Object.entries(oModel.getPendingChanges()).length > 0) oModel.submitChanges();
			else {
				this._oViewModel.setProperty("/busy", false);
				this.onCancel();
			}
		},

		_checkIfBatchRequestSucceeded: function (oEvent) {
			var oParams = oEvent.getParameters();
			var aRequests = oEvent.getParameters().requests;
			var oRequest;
			if (oParams.success) {
				if (aRequests) {
					for (var i = 0; i < aRequests.length; i++) {
						oRequest = oEvent.getParameters().requests[i];
						if (!oRequest.success) {
							return false;
						}
					}
				}
				return true;
			} else {
				return false;
			}
		},

		/**
		 * Event handler (attached declaratively) for the view cancel button. Asks the user confirmation to discard the changes. 
		 * @function
		 * @public
		 */
		onCancel: function () {
			// check if the model has been changed
			if (this._oODataModel.hasPendingChanges()) {
				// get user confirmation first
				this._showConfirmQuitChanges(); // some other thing here....
			} else {
				this._oViewModel.setProperty("/addEnabled", true);
				// cancel without confirmation
				this._navBack();
			}
		},

		/* =========================================================== */
		/* Internal functions
		/* =========================================================== */
		/**
		 * Navigates back in the browser history, if the entry was created by this app.
		 * If not, it navigates to the Details page
		 * @private
		 */
		_navBack: function () {
			this._oODataModel.resetChanges();
			this.getRouter().getTargets().display("EventList");
			this.getView().unbindObject();
		},

		/**
		 * Checks if the save button can be enabled
		 * @private
		 */
		_validateSaveEnablement: function (oEvent) {
			var start = this.getView().byId("StartDateTime_id").getDateValue() || new Date(this.getView().byId("StartDateTime_id").getValue());
			var end = this.getView().byId("EndDateTime_id").getDateValue() || new Date(this.getView().byId("EndDateTime_id").getValue());
			if (oEvent) var id = oEvent.getParameter("id");
			if (id && (id.includes("Start") || id.includes("End")) && this.getView().byId("cbAllDay").getSelected()) { //set time to all day
				start = new Date(start.setHours(0, 0));
				this.getView().byId("StartDateTime_id").setDateValue(start);
				end = new Date(end.setHours(23, 59));
				this.getView().byId("EndDateTime_id").setDateValue(end);
			}
			//check dates
			if (start > end) {
				this.getView().byId("StartDateTime_id").setValueState("Error");
				this.getView().byId("EndDateTime_id").setValueState("Error");
				this._oViewModel.setProperty("/enableCreate", false);
				return;
			} else {
				this.getView().byId("StartDateTime_id").setValueState("None");
				this.getView().byId("EndDateTime_id").setValueState("None");
				this._oViewModel.setProperty("/enableCreate", true);
			}
			// check mandatory
			var aInputControls = this._getFormFields(this.byId("newEntitySimpleForm"));
			var oControl;
			for (var m = 0; m < aInputControls.length; m++) {
				oControl = aInputControls[m].control;
				if (aInputControls[m].required) {
					var sValue = oControl.getMetadata().getName() === "sap.m.MultiInput" ? oControl.getTokens().length > 0 : oControl.getValue();
					if ((oControl.getMetadata().getName() === "sap.m.MultiInput" && sValue === false) || !sValue) {
						this._oViewModel.setProperty("/enableCreate", false);
						return;
					}
				}
			}
			this._checkForErrorMessages();
		},

		_setDateAllDay: function (oEvent) {
			if (oEvent.getParameter("selected")) {
				var start = this.getView().byId("StartDateTime_id").getDateValue() ||
					(this.getView().byId("StartDateTime_id").getValue() ? new Date(this.getView().byId("StartDateTime_id").getValue()) : "");
				var end = this.getView().byId("EndDateTime_id").getDateValue() ||
					(this.getView().byId("EndDateTime_id").getValue() ? new Date(this.getView().byId("EndDateTime_id").getValue()) : "");
				if (start) {
					start = new Date(start.setHours(0, 0));
					this._oODataModel.setProperty(this.getView().getBindingContext().getPath() + "/StartDateTime", start);
					this.getView().byId("StartDateTime_id").setDateValue(start);
				}
				if (end) {
					end = new Date(end.setHours(23, 59));
					this._oODataModel.setProperty(this.getView().getBindingContext().getPath() + "/EndDateTime", end);
					this.getView().byId("EndDateTime_id").setDateValue(end);
				}
				this._validateSaveEnablement();
			}
		},

		/**
		 * Checks if there is any wrong inputs that can not be saved.
		 * @private
		 */

		_checkForErrorMessages: function () {
			var aMessages = this._oBinding.oModel.oData;
			if (aMessages.length > 0) {
				var bEnableCreate = true;
				for (var i = 0; i < aMessages.length; i++) {
					if (aMessages[i].type === "Error" && !aMessages[i].technical) {
						bEnableCreate = false;
						break;
					}
				}
				this._oViewModel.setProperty("/enableCreate", bEnableCreate);
			} else {
				this._oViewModel.setProperty("/enableCreate", true);
			}
		},

		/**
		 * Opens a dialog letting the user either confirm or cancel the quit and discard of changes.
		 * @private
		 */
		_showConfirmQuitChanges: function () {
			var oComponent = this.getOwnerComponent();
			var that = this;
			MessageBox.confirm(
				this._oResourceBundle.getText("confirmCancelMessage"), {
					styleClass: oComponent.getContentDensityClass(),
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							that.getModel("appView").setProperty("/addEnabled", true);
							that._navBack();
						}
					}
				}
			);
		},
		/**
		 * Handles the onDisplay event which is triggered when this view is displayed 
		 * @param {sap.ui.base.Event} oEvent the on display event
		 * @private
		 */
		_onDisplay: function (oEvent) {
			var oData = oEvent.getParameter("data");
			this.getView().byId("StartDateTime_id").addEventDelegate({
				onAfterRendering: function () {
					var oDateInner = this.$().find('.sapMInputBaseInner');
					var oID = oDateInner[0].id;
					$('#' + oID).attr("disabled", "disabled");
				}
			}, this.getView().byId("StartDateTime_id"));
			this.getView().byId("EndDateTime_id").addEventDelegate({
				onAfterRendering: function () {
					var oDateInner = this.$().find('.sapMInputBaseInner');
					var oID = oDateInner[0].id;
					$('#' + oID).attr("disabled", "disabled");
				}
			}, this.getView().byId("EndDateTime_id"));
			if (oData && oData.mode === "update") {
				this._onEdit(oEvent);
			} else if (oData && oData.mode === "copy") {
				this._onCreateCopy(oEvent);
			} else {
				this._onCreate(oEvent);
			}
		},

		/**
		 * Handles the success of updating an object
		 * @private
		 */
		_fnUpdateSuccess: function () {
			this._oViewModel.setProperty("/busy", false);
			this._oODataModel.resetChanges();
			this.getRouter().getTargets().display("EventList");
			this.getView().unbindObject();
		},

		/**
		 * Handles the success of creating an object
		 *@param {object} oData the response of the save action
		 * @private
		 */
		_fnEntityCreated: function (oData) {
			this._oViewModel.setProperty("/busy", false);
			this._oODataModel.resetChanges();
			this.getRouter().getTargets().display("EventList");
			MessageToast.show("New Event created");
		},

		/**
		 * Handles the failure of creating/updating an object
		 * @private
		 */
		_fnEntityCreationFailed: function () {
			this._oViewModel.setProperty("/busy", false);
		},

		/**
		 * Prepares the view for editing the selected object
		 * @param {sap.ui.base.Event} oEvent the  display event
		 * @private
		 */
		_onEdit: function (oEvent) {
			var oData = oEvent.getParameter("data"),
				oView = this.getView(),
				contacts = this.getView().getModel().getProperty(oData.objectPath).Contacts,
				aContactNames = [];
			this._oViewModel.setProperty("/mode", "edit");
			this._oViewModel.setProperty("/enableCreate", true);
			this._oViewModel.setProperty("/viewTitle", this._oResourceBundle.getText("editViewTitle"));
			//format contact id to names
			if (contacts !== null && contacts !== "") {
				aContactNames = formatter.formatEventContacts(contacts, this.getOwnerComponent().getModel("contacts").getData());
			}
			//	this.getView().byId("Contacts_id").setValue(sContactNames);
			this._oViewModel.setProperty("/Contacts", aContactNames);
			this.oView.byId("Contacts_id").bindAggregation("tokens", {
				path: "viewModel>/Contacts",
				template: new sap.m.Token({
					key: "{viewModel>userId}",
					text: "{viewModel>nameId}"
				})
			});
			//get Product Name if product is assigned
			var loadProductName = new Promise(function (resolve, reject) {
				var oModel = this._ZS_APP_DEP_Model,
					productId = this.getView().getModel().getProperty(oData.objectPath).MainProduct;
				if (!productId) {
					this.getView().getModel("viewModel").setProperty("/productName", "");
					resolve();
					return;
				}
				oModel.read("/ProductSet", {
					filters: [new Filter("ProductNR", "EQ", productId)],
					success: function (data) {
						this.getView().getModel("viewModel").setProperty("/productName", data.results[0].ProductName);
						resolve();
					}.bind(this),
					error: function (err) {
						this.getView().getModel("viewModel").setProperty("/productName", "");
						resolve();
					}.bind(this)
				});
			}.bind(this));
			loadProductName.then(function () {
				this.getView().setBindingContext(this._oODataModel.getContext(oData.objectPath));
				//markdown editor issues...
				this.oView.byId("markdownBox").destroyItems();
				this.oView.byId("markdownBox").addItem(new sapit.controls.MarkdownEditor({
					value: "{AdditionalInfo}",
					id: "myMarkdownEditor",
					toolbar: ["heading", "bold", "italic", "|", "unordered-list", "ordered-list", "|", "preview", "|", "guide"],
					placeholder: "Start typing...",
					spellChecker: false,
					lineWrapping: true
				}));
				/*oView.bindElement({
					path: oData.objectPath
				});*/
			}.bind(this));
		},

		/**
		 * Prepares the view for creating new object
		 * @param {sap.ui.base.Event} oEvent the  display event
		 * @private
		 */

		_onCreate: function (oEvent) {
			if (oEvent.getParameter("name") && oEvent.getParameter("name") !== "create") {
				this._oViewModel.setProperty("/enableCreate", false);
				this.getRouter().getTargets().detachDisplay(null, this._onDisplay, this);
				this.getView().unbindObject();
				return;
			}
			this._oViewModel.setProperty("/Contacts", []);
			this._oViewModel.setProperty("/productName", "");
			this._oViewModel.setProperty("/viewTitle", this._oResourceBundle.getText("createViewTitle"));
			this._oViewModel.setProperty("/mode", "create");
			var oContext = this._oODataModel.createEntry("Events", {
				properties: {
					AdditionalInfo: "",
					Status: "Draft",
					EventDetails: "",
					EventName: "",
					EventType: "",
					SolutionArea: "",
					StartDateTime: null,
					EndDateTime: null
				},
				success: this._fnEntityCreated.bind(this),
				error: this._fnEntityCreationFailed.bind(this)
			});
			this.getView().setBindingContext(oContext);
		},
		_onCreateCopy: function (oEvent) {
			if (oEvent.getParameter("name") && oEvent.getParameter("name") !== "create") {
				this._oViewModel.setProperty("/enableCreate", false);
				this.getRouter().getTargets().detachDisplay(null, this._onDisplay, this);
				this.getView().unbindObject();
				return;
			}

			var aContactNames = [],
				path = oEvent.getParameter("data").objectPath,
				object = this.getView().getModel().getProperty(path),
				contacts = object.Contacts,
				productId = object.MainProduct;

			this._oViewModel.setProperty("/viewTitle", this._oResourceBundle.getText("createViewTitle"));
			this._oViewModel.setProperty("/mode", "create");
			//format contact id to names
			if (contacts !== null && contacts !== "") {
				aContactNames = formatter.formatEventContacts(contacts, this.getOwnerComponent().getModel("contacts").getData());
			}
			this._oViewModel.setProperty("/Contacts", aContactNames);
			this.oView.byId("Contacts_id").bindAggregation("tokens", {
				path: "viewModel>/Contacts",
				template: new sap.m.Token({
					key: "{viewModel>userId}",
					text: "{viewModel>nameId}"
				})
			});
			//get Product Name if product is assigned
			new Promise(function (resolve, reject) {
				var oModel = this._ZS_APP_DEP_Model;
				if (!productId) {
					this.getView().getModel("viewModel").setProperty("/productName", "");
					resolve();
					return;
				}
				oModel.read("/ProductSet", {
					filters: [new Filter("ProductNR", "EQ", productId)],
					success: function (data) {
						this.getView().getModel("viewModel").setProperty("/productName", data.results[0].ProductName);
						resolve();
					}.bind(this),
					error: function (err) {
						this.getView().getModel("viewModel").setProperty("/productName", "");
						resolve();
					}.bind(this)
				});
			}.bind(this)).then(function () {
				var oContext = this._oODataModel.createEntry("Events", {
					properties: {
						EventName: object.EventName,
						EventDetails: object.EventDetails,
						StartDateTime: object.StartDateTime,
						EndDateTime: object.EndDateTime,
						Status: "Draft",
						EventType: object.EventType,
						SolutionArea: object.SolutionArea,
						MainProduct: object.MainProduct,
						URL: object.URL,
						URLDesc: object.URLDesc,
						Contacts: object.Contacts,
						AdditionalInfo: object.AdditionalInfo
					},
					success: this._fnEntityCreated.bind(this),
					error: this._fnEntityCreationFailed.bind(this)
				});
				this.getView().setBindingContext(oContext);
				//markdown editor issues...
				this.oView.byId("markdownBox").destroyItems();
				this.oView.byId("markdownBox").addItem(new sapit.controls.MarkdownEditor({
					value: "{AdditionalInfo}",
					id: "myMarkdownEditor",
					toolbar: ["heading", "bold", "italic", "|", "unordered-list", "ordered-list", "|", "preview", "|", "guide"],
					placeholder: "Start typing...",
					spellChecker: false,
					lineWrapping: true
				}));
				this._validateSaveEnablement();
			}.bind(this));
		},


		onEmployeeSelected: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			var user = oSelectedItem.getBindingContext("employees").getModel().getProperty(oSelectedItem.getBindingContext("employees").getPath());
			var sUserId = user.ID,
				oUserName = user.firstName + " " + user.lastName,
				newContact = { //contact object for display
					userId: sUserId,
					nameId: oUserName + " (" + sUserId + ")"
				},
				sUserString = "", // string of ids to save
				aContacts = this._oViewModel.getProperty("/Contacts");
			aContacts.push(newContact);
			aContacts.forEach(function (contact) {
				sUserString += contact.userId + ",";
			});
			this.getOwnerComponent().getModel("contacts").getData().push(oUserName + " (" + sUserId + ")");
			/*if (this._oViewModel.getProperty("/mode") === "edit") {
				this.getView().getModel().setProperty(this.getView().getObjectBinding().getPath() + "/Contacts", sUserString.substring(0,
					sUserString.length - 1));
			} else {*/
			this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/Contacts", sUserString.substring(0,
				sUserString.length - 1));
			//	}
			this._oViewModel.setProperty("/Contacts", aContacts);
			this.onEmployeeDialogClose(oEvent);
			this._validateSaveEnablement();
		},

		updateContactsToken: function (oEvent) {
			if (oEvent.getParameter("type") === "removed") {
				var aRemoved = oEvent.getParameter("removedTokens"),
					aContacts = this._oViewModel.getProperty("/Contacts"),
					sUserString = "";
				aRemoved.forEach(function (token) {
					var removedContact;
					aContacts.every(function (contact, i) {
						if (token.getKey() === contact.userId) {
							removedContact = i;
							return false;
						}
						return true;
					});
					if (removedContact !== undefined) aContacts.splice(removedContact, 1);
				});
				aContacts.forEach(function (contact) {
					sUserString += contact.userId + ",";
				});
				/*	if (this._oViewModel.getProperty("/mode") === "edit") {
						this.getView().getModel().setProperty(this.getView().getObjectBinding().getPath() + "/Contacts", sUserString.substring(0,
							sUserString.length - 1));
					} else {*/
				this.getView().getModel().setProperty(this.getView().getBindingContext().getPath() + "/Contacts", sUserString.substring(0,
					sUserString.length - 1));
				//	}
				this._oViewModel.setProperty("/Contacts", aContacts);
			}
			this._validateSaveEnablement(oEvent);
		},

		openSolutionDialog: function () {
			if (!this.oView.getModel("ProductLines") && !this.oSolutionDialog) {
				var that = this;
				var load = this.loadProductLine(this);
				load.then(function () {
					that.oSolutionDialog = sap.ui.xmlfragment(that.oView.getId(),
						"mcc.workbench.admin.settings.view.SolutionHub.Events.AffectedProductDialog", that);
					that.oView.addDependent(that.oSolutionDialog);
					that.oSolutionDialog.open();
				});
			} else if (!this.oSolutionDialog) {
				this.oSolutionDialog = sap.ui.xmlfragment(this.oView.getId(),
					"mcc.workbench.admin.settings.view.SolutionHub.Events.AffectedProductDialog", that);
				this.oView.addDependent(this.oSolutionDialog);
				this.oSolutionDialog.open();
			} else {
				var navCon = this.oView.byId("navContainer");
				this.oView.byId("buttonAdd").setEnabled(false);
				navCon.to(this.oView.byId("selectProductLine"), "slide");
				this.oSolutionDialog.open();
			}
		},

		/*loadProductLine: function () {
			var that = this;
			var oModel = this._ZS_APP_DEP_Model;
			return new Promise(function (resolve, reject) {
				oModel.read("/ProductLineSet", {
					urlParameters: {
						"$top": 9999
					},
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.LineName < b.LineName) {
								return -1;
							}
							if (b.LineName < a.LineName) {
								return 1;
							}
							return 0;
						});
						var oProductLineModel = new JSONModel();
						oProductLineModel.setData(oData.results);
						that.getView().setModel(oProductLineModel, "ProductLines");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "ProductLines");
						resolve();
					}
				});
			});
		},

		loadAllProducts: function (that) {
			return new Promise(function (resolve, reject) {
				var oModel = that._ZS_APP_DEP_Model;
				oModel.read("/ProductSet", {
					urlParameters: {
						"$top": 20000
					},
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.ProductName < b.ProductName) {
								return -1;
							}
							if (b.ProductName < a.ProductName) {
								return 1;
							}
							return 0;
						});
						that.getView().setModel(new JSONModel(oData.results), "Products");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "Products");
						resolve();
					}
				});
			});
		},

		loadProducts: function (that, index) {
			return new Promise(function (resolve, reject) {
				var lineId = that.getView().getModel("ProductLines").getData()[index].LineID;
				var oModel = that._ZS_APP_DEP_Model;
				if (!lineId) {
					that.getView().setModel(new JSONModel([]), "Products");
					resolve();
					return;
				}
				oModel.read("/ProductLineSet('" + lineId + "')/toProduct", {
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.ProductName < b.ProductName) {
								return -1;
							}
							if (b.ProductName < a.ProductName) {
								return 1;
							}
							return 0;
						});
						that.getView().setModel(new JSONModel(oData.results), "Products");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "Products");
						resolve();
					}
				});
			});
		},*/

		/*	onTabBarSelected: function (oEvent) {
				var that = this;
				var navCon = this.oView.byId("navContainer");
				this.oSolutionDialog.setBusy(true);
				if (oEvent.getParameter("selectedKey") === "line") {
					this.oView.byId("buttonAdd").setEnabled(false);
					navCon.to(this.oView.byId("selectProductLine"), "slide");
					this.oSolutionDialog.setBusy(false);
				} else if (oEvent.getParameter("selectedKey") === "product") {
					this.oView.byId("buttonAdd").setEnabled(false);
					var load = that.loadAllProducts(that);
					load.then(function () {
						that.oSolutionDialog.setBusy(false);
						navCon.to(that.oView.byId("selectProduct"), "slide");
					});
				}

				if (oEvent.getSource().getId().indexOf("line") > -1) {
					oEvent.getSource().setSelectedKey("line");
				} else if (oEvent.getSource().getId().indexOf("product") > -1) {
					oEvent.getSource().setSelectedKey("product");
				}
			},
			handleNavNext: function (oEvent) {
				this.oSolutionDialog.setBusy(true);
				var that = this;
				var navCon = this.oView.byId("navContainer");
				var listItemIndex = oEvent.getSource().getBindingContextPath().substring(1);
				if (navCon.getCurrentPage().getId().indexOf("selectProductLine") > -1) {
					var load = that.loadProducts(this, listItemIndex);
					load.then(function () {
						that.oSolutionDialog.setBusy(false);
						navCon.to(that.oView.byId("selectProduct"), "slide");
					});
				}
			},

			onSelectProduct: function () {
				this.oView.byId("buttonAdd").setEnabled(true);
			},

			handleNavBack: function (oEvent) {
				var navCon = this.oView.byId("navContainer");
				if (navCon.getCurrentPage().getId() !== "selectProductVersion") {
					this.oView.byId("buttonAdd").setEnabled(false);
				}
				navCon.back();
			},

			handleCancel: function () {
				this.oSolutionDialog.close();
			},*/

		addSolution: function () {
			this.oSolutionDialog.setBusy(true);
			if (this.oView.byId("listProducts").getSelectedContextPaths().length > 0) {
				var index = this.oView.byId("listProducts").getSelectedContextPaths()[0].substring(1);
				var ProductNR = this.oView.getModel("Products").getData()[index].ProductNR;
				var ProductName = this.oView.getModel("Products").getData()[index].ProductName;
				//	this.oView.byId("MainProduct_id").setValue(ProductNR);
				this.oView.getModel("viewModel").setProperty("/productName", ProductName);
				/*	if (this._oViewModel.getProperty("/mode") === "edit") {
						this.getModel("SolutionHub").setProperty(this.getView().getObjectBinding().getPath() + "/MainProduct", ProductNR);
					} else {*/
				this.getModel("SolutionHub").setProperty(this.getView().getBindingContext().getPath() + "/MainProduct", ProductNR);
				//	}
			}
			this.oSolutionDialog.setBusy(false);
			this.oSolutionDialog.close();
		},

		/*	onSearchLine: function (oEvent) {
				// add filter for search
				var aFilters = [];
				var sQuery = oEvent.getSource().getValue();
				if (sQuery && sQuery.length > 0) {
					var filter = new Filter("LineName", sap.ui.model.FilterOperator.Contains, sQuery);
					aFilters.push(filter);
				}

				// update list binding
				var oList = this.oView.byId("listProductLines");
				var oBinding = oList.getBinding("items");
				oBinding.filter(aFilters, "Application");
			},

			onSearchProduct: function (oEvent) {
				// add filter for search
				var aFilters = [];
				var sQuery = oEvent.getSource().getValue();
				if (sQuery && sQuery.length > 0) {
					var filter = new Filter("ProductName", sap.ui.model.FilterOperator.Contains, sQuery);
					aFilters.push(filter);
				}

				// update list binding
				var oList = this.oView.byId("listProducts");
				var oBinding = oList.getBinding("items");
				oBinding.filter(aFilters, "Application");
			}*/
	});
});
