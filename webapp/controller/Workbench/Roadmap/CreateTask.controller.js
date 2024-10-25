sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox"

], function (BaseController, JSONModel, MessageBox) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.Workbench.Roadmap.CreateTask", {

		_oBinding: {},

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			var that = this;
			this.getRouter().getTargets().getTarget("createRoadmapTask").attachDisplay(null, this._onDisplay, this);
			this._oODataModel = this.getOwnerComponent().getModel("AdminApp");
			this._oResourceBundle = this.getResourceBundle();
			this._oViewModel = new JSONModel({
				enableCreate: false,
				delay: 0,
				busy: false,
				mode: "create",
				viewTitle: "Create Task",
				aDeleteTaskLinks: [],
				aCreateModeLinks: [],
				iCreateModeLinks: 0,
				newTaskID: "",
				TaskTypeDropdownValues: [{
					"Key": "Mail",
					"Name": "Mail",
					"visible": true
				}, {
					"Key": "Document",
					"Name": "Document",
					"visible": true
				}, {
					"Key": "URL",
					"Name": "URL",
					"visible": true
				}, {
					"Key": "Other",
					"Name": "Other",
					"visible": true
				}, {
					"Key": "Checkpoint",
					"Name": "Checkpoint",
					"visible": false
				}],
				CategoryDropdownValues: [{
					"Key": 1,
					"Name": "Process Step",
					"visible": true
				}, {
					"Key": 2,
					"Name": "Checkpoint",
					"visible": false
				}, {
					"Key": 3,
					"Name": "Reoccurring Task",
					"visible": false
				}, {
					"Key": 4,
					"Name": "Accelerator",
					"visible": false
				}],
				RegionDropdownValues: [{
					"Key": 128,
					"Name": "All",
					"visible": true
				}, {
					"Key": 1,
					"Name": "EMEA",
					"visible": true
				}, {
					"Key": 2,
					"Name": "APJ",
					"visible": true
				}, {
					"Key": 4,
					"Name": "NA",
					"visible": true
				}, {
					"Key": 8,
					"Name": "LA",
					"visible": true
				}],
				ScenarioDropdownValues: [{
					"Key": 1,
					"Name": "1",
					"visible": true
				}, {
					"Key": 2,
					"Name": "2",
					"visible": true
				}, {
					"Key": 3,
					"Name": "3",
					"visible": true
				}, {
					"Key": 6,
					"Name": "2,3",
					"visible": true
				}, {
					"Key": 7,
					"Name": "1,2,3",
					"visible": true
				}]
			});
			this.setModel(this._oViewModel, "viewModel");

			// Register the view with the message manager
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
			var oMessagesModel = sap.ui.getCore().getMessageManager().getMessageModel();
			this._oBinding = new sap.ui.model.Binding(
				oMessagesModel, "/", oMessagesModel.getContext("/"));
			this._oBinding.attachChange(function (oEvent) {
				var aMessages = oEvent.getSource().getModel().getData();
				for (var i = 0; i < aMessages.length; i++) {
					if (aMessages[i].type === "Error" && !aMessages[i].technical) {
						that._oViewModel.setProperty("/enableCreate", false);
					}
				}
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler (attached declaratively) for the view save button. Saves the changes added by the user. 
		 * @function
		 * @public
		 */
		onSave: function () {
			// abort if the  model has not been changed
			if (!this._oODataModel.hasPendingChanges() && this._oViewModel.getProperty("/aDeleteTaskLinks").length === 0) {
				MessageBox.information(
					this._oResourceBundle.getText("noChangesMessage"), {
						id: "noChangesInfoMessageBox",
						styleClass: this.getOwnerComponent().getContentDensityClass()
					}
				);
				return;
			}
			this.getModel("appView").setProperty("/busy", true);
			if (this._oODataModel.hasPendingChanges()) {
				var bChanges = true;
				if (this._oViewModel.getProperty("/mode") === "edit") {
					// attach to the request completed event of the batch
					this._oODataModel.attachEventOnce("batchRequestCompleted", function (oEvent) {
						if (this._checkIfBatchRequestSucceeded(oEvent)) {
							this._fnUpdateSuccess();
						} else {
							this._fnEntityCreationFailed();
							MessageBox.error(this._oResourceBundle.getText("updateErrorTask"));
						}
					}.bind(this));
				}
				var categoryId = this._oODataModel.getProperty(this.getView().getBindingContext("AdminApp").getPath() + "/CategoryID");
				this._oViewModel.getProperty("/CategoryDropdownValues").forEach(function (value) {
					if (value.Key === categoryId) {
						this._oODataModel.setProperty(this.getView().getBindingContext("AdminApp").getPath() + "/CategoryName", value.Name);
					}
				}.bind(this));
				//	this._oODataModel.submitChanges();
			}
			if (this._oViewModel.getProperty("/aDeleteTaskLinks").length > 0) {
				//delete task links entries
				var aChanges = this._oODataModel.getPendingChanges();
				this._oViewModel.getProperty("/aDeleteTaskLinks").forEach(function (path) {
					this._oODataModel.remove(path, {
						success: function () {
							if (!bChanges) this._fnUpdateSuccess();
						}.bind(this),
						error: function () {
							if (!bChanges) this._fnEntityCreationFailed();
							if (!bChanges) MessageBox.error(this._oResourceBundle.getText("deleteErrorLink"));
						}.bind(this)
					});
					if (aChanges[path]) this._oODataModel.resetChanges([path]);
				}.bind(this));
				this._oViewModel.setProperty("/aDeleteTaskLinks", []);
			}
			//needs to be fired last to prevent update and delete of the same link entry
			if (this._oODataModel.hasPendingChanges()) this._oODataModel.submitChanges();
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
			if (this.getModel("AdminApp").hasPendingChanges()) {
				// get user confirmation first
				this._showConfirmQuitChanges(); // some other thing here....
			} else {
				this.getModel("appView").setProperty("/addEnabled", true);
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
			this.getModel("AdminApp").resetChanges();
			this.getView().unbindObject();
			this.getRouter().getTargets().display("RoadmapTasks");
			//	this.getRouter().navTo("RoadmapPhases");
		},

		/**
		 * Opens a dialog letting the user either confirm or cancel the quit and discard of changes.
		 * @private
		 */
		_showConfirmQuitChanges: function () {
			var oComponent = this.getOwnerComponent();
			//	oModel = this.getModel("AdminApp");
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
		 * Prepares the view for editing the selected object
		 * @param {sap.ui.base.Event} oEvent the  display event
		 * @private
		 */
		_onEdit: function (oEvent) {
			var oData = oEvent.getParameter("data");
			this._oViewModel.setProperty("/mode", "edit");
			this._oViewModel.setProperty("/enableCreate", true);
			this._oViewModel.setProperty("/viewTitle", "Edit Task");
			if (this._oODataModel.getProperty(oData.objectPath).RoadmapProfileID === "mcs-gem") {
				this._oViewModel.setProperty("/CategoryDropdownValues/2/visible", true); //reoccuring task
				this._oViewModel.setProperty("/CategoryDropdownValues/3/visible", false); //accelarator
			} else if (this._oODataModel.getProperty(oData.objectPath).RoadmapProfileID === "mcc-gss") {
				this._oViewModel.setProperty("/CategoryDropdownValues/2/visible", false);
				this._oViewModel.setProperty("/CategoryDropdownValues/3/visible", true);
			}

			this.getView().setBindingContext(this.getModel("AdminApp").getContext(oData.objectPath), "AdminApp");
			//markdown editor issues...
			this.oView.byId("markdownBox").destroyItems();
			this.oView.byId("markdownBox").addItem(new sapit.controls.MarkdownEditor({
				value: "{AdminApp>Description}",
				id: "myMarkdownEditor",
				liveChange: this._validateSaveEnablement.bind(this),
				toolbar: ["heading", "bold", "italic", "|", "unordered-list", "ordered-list", "|", "preview", "|", "guide"],
				placeholder: "Start typing...",
				spellChecker: false,
				lineWrapping: true
			}));

			this.oView.byId("linksTable").bindAggregation("items", {
				path: "AdminApp>/TaskLinks",
				filters: [new sap.ui.model.Filter("toTask_TaskID", sap.ui.model.FilterOperator.EQ, this._oODataModel.getProperty(oData.objectPath)
					.TaskID)],
				sorter: new sap.ui.model.Sorter("createdAt", true),
				template: new sap.m.ColumnListItem({
					cells: [new sap.m.Input({
						value: "{AdminApp>Name}",
						valueState: "{= ${AdminApp>Name}.length === 0 ? 'Error' : 'None'}"
					}), new sap.m.Input({
						value: "{AdminApp>URL}",
						valueState: "{= ${AdminApp>URL}.length === 0 ? 'Error' : 'None'}",
						type: "Url"
					})],
					type: "Inactive"
				})
			});
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

			this._oViewModel.setProperty("/viewTitle", this._oResourceBundle.getText("createViewTitle"));
			this._oViewModel.setProperty("/mode", "create");
			this._oViewModel.setProperty("/iCreateModeLinks", 0);
			this._oViewModel.setProperty("/aCreateModeLinks", []);
			this._oViewModel.setProperty("/newTaskID", "");
			if (this._oODataModel.getProperty(oEvent.getParameter("data").objectPath).RoadmapProfileID === "mcs-gem") {
				this._oViewModel.setProperty("/CategoryDropdownValues/2/visible", true);
				this._oViewModel.setProperty("/CategoryDropdownValues/3/visible", false);
			} else if (this._oODataModel.getProperty(oEvent.getParameter("data").objectPath).RoadmapProfileID === "mcc-gss") {
				this._oViewModel.setProperty("/CategoryDropdownValues/2/visible", false);
				this._oViewModel.setProperty("/CategoryDropdownValues/3/visible", true);
			}
			var oContext = this._oODataModel.createEntry("Tasks", {
				properties: {
					TaskType: "URL",
					CategoryID: 1,
					CategoryName: "Process Step",
					Importance: "M",
					Region: 128,
					ScenarioID: this._oODataModel.getProperty(oEvent.getParameter("data").objectPath).RoadmapProfileID === "mcc-gss" ? null : 7,
					Description: "",
					toPhase_ID: this._oODataModel.getProperty(oEvent.getParameter("data").objectPath).ID,
					RoadmapProfileID: this._oODataModel.getProperty(oEvent.getParameter("data").objectPath).RoadmapProfileID,
					Deprecated: false,
					Editable: true
				},
				success: this._fnEntityCreated.bind(this),
				error: this._fnEntityCreationFailed.bind(this)
			});
			this.getView().setBindingContext(oContext, "AdminApp");

			this._oViewModel.setProperty("/createPath", oContext.getPath());

			this.oView.byId("linksTable").unbindAggregation("items");
		},

		/**
		 * Checks if the save button can be enabled
		 * @private
		 */
		_validateSaveEnablement: function () {
			//check form content
			var aInputControls = this._getFormFields(this.byId("newEntitySimpleForm"));
			var oControl;
			for (var m = 0; m < aInputControls.length; m++) {
				oControl = aInputControls[m].control;
				if (aInputControls[m].required) {
					var sValue = oControl.getValue();
					if (!sValue) {
						this._oViewModel.setProperty("/enableCreate", false);
						return;
					}
				}
			}
			//check links
			var items = this.oView.byId("linksTable").getItems();
			items.forEach(function (item) {
				if (!item.getCells()[0].getValue() || !item.getCells()[1].getValue()) {
					this._oViewModel.setProperty("/enableCreate", false);
					return;
				}
			}.bind(this));
			this._checkForErrorMessages();
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
		 * Handles the success of updating an object
		 * @private
		 */
		_fnUpdateSuccess: function () {
			this.getModel("appView").setProperty("/busy", false);
			this.getView().unbindObject();
			this.getRouter().getTargets().display("RoadmapTasks");
		},

		/**
		 * Handles the success of creating an object
		 *@param {object} oData the response of the save action
		 * @private
		 */
		_fnEntityCreated: function (oData) {
			var sObjectPath;
			if (oData.ID) {
				sObjectPath = this.getModel("AdminApp").createKey("TaskLinks", oData);
				if (this._oViewModel.getProperty("/mode") === "create") {
					var links = this._oViewModel.getProperty("/aCreateModeLinks");
					links.push("/TaskLinks(guid'" + oData.ID + "')");
					this._fnTaskCreatedUpdateLinks(sObjectPath);
				}
			}
			if (oData.TaskID) {
				sObjectPath = this.getModel("AdminApp").createKey("Tasks", oData);
				if (this._oViewModel.getProperty("/iCreateModeLinks") === 0) {
					this.getModel("appView").setProperty("/itemToSelect", "/AdminApp" + sObjectPath);
					this.getModel("appView").setProperty("/busy", false);
					this.getRouter().getTargets().display("RoadmapTasks");
				} else {
					this._oViewModel.setProperty("/newTaskID", oData.TaskID);
					this._fnTaskCreatedUpdateLinks(sObjectPath);
				}
			}
		},
		_fnTaskCreatedUpdateLinks: function (sObjectPath) {
			if (this._oViewModel.getProperty("/iCreateModeLinks") === this._oViewModel.getProperty("/aCreateModeLinks").length &&
				this._oViewModel.getProperty("/newTaskID")) {
				this._oViewModel.getProperty("/aCreateModeLinks").forEach(function (path) {
					this._oODataModel.update(path, {
						"toTask_TaskID": this._oViewModel.getProperty("/newTaskID")
					});
				}.bind(this));

				this.getModel("appView").setProperty("/itemToSelect", "/AdminApp" + sObjectPath);
				this.getModel("appView").setProperty("/busy", false);
				this.getRouter().getTargets().display("RoadmapTasks");
			} else return;
		},

		/**
		 * Handles the failure of creating/updating an object
		 * @private
		 */
		_fnEntityCreationFailed: function () {
			this.getModel("appView").setProperty("/busy", false);
		},

		/**
		 * Handles the onDisplay event which is triggered when this view is displayed 
		 * @param {sap.ui.base.Event} oEvent the on display event
		 * @private
		 */
		_onDisplay: function (oEvent) {
			var oData = oEvent.getParameter("data");
			this._oViewModel.setProperty("/aDeleteTaskLinks", []);
			if (oData && oData.mode === "update") {
				this._onEdit(oEvent);
			} else {
				this._onCreate(oEvent);
			}
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
				if (sControlType === "sap.m.Input" || sControlType === "sap.m.Select" ||
					sControlType === "sap.m.CheckBox" || sControlType === "sap.m.Switch" ||
					sControlType === "sapit.controls.MarkdownEditor") {
					aControls.push({
						control: aFormContent[i],
						required: aFormContent[i - 1].getRequired && aFormContent[i - 1].getRequired()
					});
				}
			}
			return aControls;
		},

		changeImportance: function (oEvent) {
			var importance = oEvent.getParameter("state");
			if (importance === true) {
				this._oODataModel.setProperty(this.getView().getBindingContext("AdminApp").getPath() + "/Importance", "M");
			} else if (importance === false) {
				this._oODataModel.setProperty(this.getView().getBindingContext("AdminApp").getPath() + "/Importance", "O");
			}
		},

		onAddTaskLink: function (oEvent) {
			var path, properties = {
				URL: "",
				Name: ""
			};
			if (this._oViewModel.getProperty("/mode") === "edit") {
				path = this.oView.getBindingContext("AdminApp").getPath();
				properties.toTask_TaskID = this._oODataModel.getProperty(path).TaskID;
			}
			if (this._oViewModel.getProperty("/mode") === "create") path = this._oViewModel.getProperty("/createPath");
			var phaseId = this._oODataModel.getProperty(path).toPhase_ID,
				oPhase = this._oODataModel.getProperty("/Phases(guid'" + phaseId + "')");
			properties.Description = "Phase " + (oPhase.Positon + 1) + ": " + oPhase.Name;

			var oContext = this._oODataModel.createEntry("TaskLinks", {
				properties: properties,
				success: this._fnEntityCreated.bind(this),
				error: this._fnEntityCreationFailed.bind(this)
			});
			this.oView.byId("linksTable").insertItem(new sap.m.ColumnListItem({
				type: "Inactive",
				cells: [
					new sap.m.Input({
						value: "{AdminApp>Name}",
						valueState: "{= ${AdminApp>Name}.length === 0 ? 'Error' : 'None'}"
					}), new sap.m.Input({
						value: "{AdminApp>URL}",
						valueState: "{= ${AdminApp>URL}.length === 0 ? 'Error' : 'None'}",
						type: "Url"
					})
				]
			}).setBindingContext(oContext, "AdminApp"), 0);
			this._oViewModel.setProperty("/iCreateModeLinks", this._oViewModel.getProperty("/iCreateModeLinks") + 1);
		},

		onDeleteTaskLink: function (oEvent) {
			var path = oEvent.getParameter("listItem").getBindingContextPath();
			if (path.includes("id-")) { //new entry
				this._oODataModel.resetChanges([path], undefined, true);
				this._oViewModel.setProperty("/iCreateModeLinks", this._oViewModel.getProperty("/iCreateModeLinks") - 1);
			} else if (this._oViewModel.getProperty("/mode") === "edit") {
				//collect paths to delete on save
				var aLinks = this._oViewModel.getProperty("/aDeleteTaskLinks");
				aLinks.push(path);
				//set list item to invisible
				oEvent.getParameter("listItem").setVisible(false);
			}
		}
	});

});