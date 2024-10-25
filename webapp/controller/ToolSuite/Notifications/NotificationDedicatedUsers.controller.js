sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/ui/model/Filter",
	'sap/ui/model/json/JSONModel'

], function (BaseController, MessageToast, MessageBox, formatter, Filter, JSONModel) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.Notifications.NotificationDedicatedUsers", {
		formatter: formatter,

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.view.NotificationSettings
		 */
		onInit: function () {
			this._oModel = this.getOwnerComponent().getModel("MCCToolSuite");
			this.setModel(new JSONModel(), "searchResult");
			this._oLocalModel = new JSONModel();
			this.setModel(this._oLocalModel, "localModel");
		},

		onPressFilterDesc: function(oEvent) {

			var oText = new sap.m.Text({
				width: "30rem",
				text: "Filter values maintained directly in HDB are shown here."
			});

			oText.addStyleClass("sapUiTinyMargin");

			// Create popover
			if (!this._oPopover) {
				this._oPopover = new sap.m.Popover({
					title: "Filter Settings",
					placement: "Bottom",
					content: [
						oText
					]
				});
		
			
			}
		
			// Open the popover
			this._oPopover.openBy(oEvent.getSource());
		},
		
		onMailChange: function (oEvent) {
			var sPath = oEvent.getSource().getBindingContext("MCCToolSuite").sPath + '/MailAddress';
			var sNewValue = this.getView().getModel("MCCToolSuite").getProperty(sPath);
			this._oModel.setProperty(sPath, sNewValue);
			this._oModel.submitChanges({
				success: function () {
					MessageToast.show("Successfully updated Mail Adresses");
				},
				error: function (oErr) {
					MessageToast.show("Error occurred: " + oErr);
					this._oModel.resetChanges();
				}
			});
		},

		onAddPress: function () {
			var dialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.ToolSuite.Notifications.CreateRow", this);
			this.oView.addDependent(dialog);
			dialog.open();

			var oSelect = this.byId("NotificationTypeSelect");

			// Set the binding context for the Select control
			oSelect.bindItems({
				path: "/NotificationTypesValueHelpProcessNotification",
				model: "MCCToolSuite",
				template: new sap.ui.core.Item({
					key: "{" + "MCCToolSuite" + ">NotificationType}",
					text: "{" + "MCCToolSuite" + ">NotificationType}"
				})
			});
		},

		onEditPress: function (oEvent) {	
			var oModel = this._oModel;
			var sPath = oEvent.getSource().getBindingContext("MCCToolSuite").sPath;
			var dialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.ToolSuite.Notifications.CreateRow", this);
			this.oView.addDependent(dialog);
			var oSelect = this.byId("NotificationTypeSelect");

			// Set the binding context for the Select control
			oSelect.bindItems({
				path: "/NotificationTypesValueHelpProcessNotification",
				model: "MCCToolSuite",
				template: new sap.ui.core.Item({
					key: "{" + "MCCToolSuite" + ">NotificationType}",
					text: "{" + "MCCToolSuite" + ">NotificationType}"
				})
			});
			dialog.open();

			oSelect.getBinding("items").attachEventOnce("dataReceived", (oEvent) => {
				oSelect.setEnabled(false);
				var notificationType = oModel.getProperty(sPath).NotificationType;
				var path = "NotificationTypesValueHelpProcessNotification('" + notificationType + "')";
				var notificationTypeProperty = oModel.getProperty("/" + path);
				this.onTypeChange(null, notificationTypeProperty.allowedFilterCriteria);
				oSelect.setSelectedKey(oModel.getProperty(sPath).NotificationType);
				
			});
			this._oLocalModel.setProperty("/itemsToBeDeleted", sPath);
			this._oLocalModel.setProperty("/editedValue", oModel.getProperty(sPath));
			dialog.setTitle("Update Notification Settings");
			this.getView().byId("createButton").setText("Save & Replace");
			
		},


		 onCreate:  function (oEvent) {
			var oModel = this.getView().getModel("MCCToolSuite");
			var aCustomers = this.getView().byId("InputCustomer").getValue();
			var aServiceTeams = this.getView().byId("ServiceTeams_ComboBox").getSelectedKeys();

			var formattedStrings = {};
			if(aCustomers.length >0)  {
				aCustomers = aCustomers.replaceAll(/&/g, 'and');
			if (aCustomers.contains("GU:")) {
				aCustomers =  aCustomers.replaceAll("GU: ", "");
				formattedStrings.notification_global_ultimate_id = aCustomers;
				this.triggerGlobalUltimatePersistence(aCustomers);
			}

			else {
				aCustomers = aCustomers.replaceAll("ERPNo: ", "");
				formattedStrings.notification_customer_id = aCustomers;
			}
			}
			if(aServiceTeams.length >0) 
			formattedStrings.notification_service_team_id = aServiceTeams.map(team => team.replaceAll(/&/g, 'and'));
			// Combine the formatted strings with '&'
			var filterString = Object.keys(formattedStrings).map(function (key) {
				return key + ' = ' + formattedStrings[key];
				}).join(' & ');

				if( this._oLocalModel.getProperty("/editedValue")) {
					var bGetTeamsNotification = this._oLocalModel.getProperty("/editedValue").bGetTeamsNotification;
					var bGetMailNotification = this._oLocalModel.getProperty("/editedValue").bGetMailNotification;
					var MailAddress=  this._oLocalModel.getProperty("/editedValue").MailAddress;
				}



			this.oNewRecipient = this.getView().getModel("MCCToolSuite").createEntry("/NotificationSettingsDedicatedUsers", {
				properties: {
					NotificationType: this.getView().byId("NotificationTypeSelect").getSelectedKey(),
					Filter: filterString,
					bGetTeamsNotification: bGetTeamsNotification || false,
					bGetMailNotification: bGetMailNotification || false,
					MailAddress: MailAddress || null

				}
			});
			var source = oEvent.getSource().getParent();
			oModel.submitChanges({
				success: function (aResponse) {		
					aResponse.__batchResponses.forEach((oResponse) => {
						if (oResponse.message === 'HTTP request failed') {
							var oError = JSON.parse(oResponse.response.body).error.message.value;
							sap.m.MessageBox.show(oError, {
								icon: sap.m.MessageBox.Icon.ERROR,
								title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
								actions: [sap.m.MessageBox.Action.CLOSE]
							});
							oModel.resetChanges();
						}

					});
					if(this._oLocalModel.getProperty("/itemsToBeDeleted") != null) {
						this.stageItemForRemoval(this._oLocalModel.getProperty("/itemsToBeDeleted"));
						this._oLocalModel.setProperty("/itemsToBeDeleted", null);
						this._oLocalModel.setProperty("/editedValue", null);

					}
				
				}.bind(this),
				error: function (oErr) {
					oModel.resetChanges();
					sap.m.MessageBox.show(oErr, {
						icon: sap.m.MessageBox.Icon.ERROR,
						title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
						actions: [sap.m.MessageBox.Action.CLOSE]
					});

				}.bind(this)
			});
			source.close();
			source.destroy();

		}
	
			

			

		

	});

});