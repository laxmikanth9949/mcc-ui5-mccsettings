sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	'sap/ui/model/json/JSONModel',
	'sap/ui/model/Filter',
	"mcc/workbench/admin/settings/model/formatter"
], function (BaseController, MessageToast, MessageBox,JSONModel, Filter, formatter) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.Notifications.NotificationSettings", {
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
			this.getView().byId("MessageStripNotificationSettings").setText("Adjust settings below according to your needs and preferences. Note: you must <a target='_blank' href='https://workzone.one.int.sap/site#workzone-home&amp;/wiki/show/dLewr6lgwQNC0oIfkyoiYo'>install the 'MCC Bot' application</a> to be able to receive notifications via MS Teams. To verify that your installation was successful, click here:");
			this.getRouter().getRoute("NotificationSettings").attachPatternMatched(this._onRouteMatched, this);

		},

		_onRouteMatched: function () {
		this._oModel.refresh();
		},

		onSegmentedButtonChange: function(oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();
			var sCurrentValue = this.getView().byId("InputCustomer").getValue();


			if (sSelectedKey == "GU") {
				if (sCurrentValue.includes("ERPNo:"))
				{	
					MessageBox.error("The existing filter already contains a value for ERPNo. Please reset your filter to filter on Global Ultimate.");
					oEvent.getSource().setSelectedKey("ERP");
								return;
				}
				this.getModel("searchResult").setProperty("/searchType", "GlobalUltimate");
				this.getView().byId("labelCustomerFilter").setText("Filter on Global Ultimate");
			}
			else {
				if (sCurrentValue.includes("GU:"))
				{	
					MessageBox.error("The existing filter already contains a value for Global Ultimate. Please reset your filter to filter on ERPNo.");
					oEvent.getSource().setSelectedKey("GU");
								return;
				}
				this.getModel("searchResult").setProperty("/searchType", "ERPNo");
				this.getView().byId("labelCustomerFilter").setText("Filter on Customer Account");
			}

		},

		onPressFilterDesc: function(oEvent) {

			var oText = new sap.m.Text({
				width: "30rem",
				text: "If you are not responsible for any MCC engagement or escalation Case, but you like to keep active subscription to desired notification types, please add your filter criteria (primarily, one or more customers of your choice)."
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

		onResetFilter: function () {
			var oTable = this.getView().byId("NotificationSettingsTable");
			// Get the binding context of the table
			var oBinding = oTable.getBinding("rows");

			// Apply the cleared filters to the binding
			oBinding.filter([]);
			// Reset filters for all columns
			var aColumns = oTable.getColumns();
			aColumns.forEach(function (oColumn) {
				if (oColumn.getFiltered()) {
					oColumn.setFiltered(false); // Reset the filtered state
					oColumn.setFilterValue(""); // Clear the filter value
					oColumn.fireFilter({}); // Trigger the filter event to update the table
				}
			});
			// Define the sorter
			var oSorter = new sap.ui.model.Sorter("toNotificationType/NotificationGroup", false); // The second parameter 'false' indicates descending sorting. Use 'true' for ascending sorting.
			// Apply the sorter to the binding
			oBinding.sort(oSorter);
		},

		
		showNotificationGroupDescription: function (oEvent) {
			this._oHelpBtn = oEvent.getSource();
			if (!this._Popover) {
				this._Popover = sap.ui.xmlfragment(this.getView().getId(),
					"mcc.workbench.admin.settings.view.ToolSuite.Notifications.HelpPopover", this);
				this.getView().addDependent(this._Popover);
			}
			this._Popover.openBy(this._oHelpBtn);
			var sDescr = this._oModel.getProperty(oEvent.getSource().getParent().getBindingContext("MCCToolSuite").getDeepPath() +
				"/toNotificationType/NotificationGroupDescription");
				var sType = this._oModel.getProperty(oEvent.getSource().getParent().getBindingContext("MCCToolSuite").getDeepPath() +
				"/toNotificationType/NotificationDescription");
			this.getView().byId("processDesc").setText(sDescr);
			this.getView().byId("typeDesc").setText(sType);

		},



		onSendTestNotification: function () {
			var oBusyIndicator = this.getView().byId("busyIndicator");
			oBusyIndicator.setVisible(true);

			var sJSONString = JSON.stringify({
				mail: this.getModel("settings").getProperty("/currentUserMail"),
				c_notification_subject: "Dummy test",
				c_notification_message: "A dummy test",
				notification_timestamp: new Date(),
				notification_url: "https://google.de"
			});

			jQuery.ajax({
					type: "POST",
					accepts: {
						json: "application/json"
					},
					url: sap.ui.require.toUrl("mcc/workbench/admin/settings")+"/apimcf/azure-mccbot/api/notification",
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r"
					},
					contentType: "application/json",
					async: true,
					data: sJSONString
				})
				.done(function (sData) {
					MessageToast.show("Response: " + sData.body);
				})
				.fail(function (jqXHR, exception, exx) {
					MessageBox.error("Notification not successful. Please verify that you installed the Teams App correctly. Response: " + jqXHR
						.responseText);

				}).always(function () {
					oBusyIndicator.setVisible(false);
				});

		},

		onAddPress: function () {
			this.getModel("searchResult").setProperty("/searchType", "ERPNo");

			var dialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.ToolSuite.Notifications.CreateRow", this);
			this.oView.addDependent(dialog);
			var oSelect = this.byId("NotificationTypeSelect");

			// Set the binding context for the Select control
			oSelect.bindItems({
				path: "/NotificationTypesValueHelpPersonalNotification",
				model: "MCCToolSuite",
				template: new sap.ui.core.Item({
					key: "{" + "MCCToolSuite" + ">NotificationType}",
					text: "{" + "MCCToolSuite" + ">NotificationType}"
				})
			});
			dialog.open();
			
		},

		onEditPress: function (oEvent) {	
				this.getModel("searchResult").setProperty("/searchType", "ERPNo");
			
			
			var oModel = this._oModel;
			var sPath = oEvent.getSource().getBindingContext("MCCToolSuite").sPath;
			var dialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.ToolSuite.Notifications.CreateRow", this);
			this.oView.addDependent(dialog);
			var oSelect = this.byId("NotificationTypeSelect");

			// Set the binding context for the Select control
			oSelect.bindItems({
				path: "/NotificationTypesValueHelpPersonalNotification",
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
				var path = "NotificationTypesValueHelpPersonalNotification('" + notificationType + "')";
				var notificationTypeProperty = oModel.getProperty("/" + path);
				this.onTypeChange(null, notificationTypeProperty.allowedFilterCriteria);
				oSelect.setSelectedKey(oModel.getProperty(sPath).NotificationType);
				
			});
			this._oLocalModel.setProperty("/itemsToBeDeleted", sPath);
			this._oLocalModel.setProperty("/editedValue", oModel.getProperty(sPath));
			dialog.setTitle("Update Notification Settings");
			this.getView().byId("createButton").setText("Save & Replace");

			
		},

	

		onCreate: function (oEvent) {
			
			var aCustomers = this.getView().byId("InputCustomer").getValue();
			var aServiceTeams = this.getView().byId("ServiceTeams_ComboBox").getSelectedKeys();

			var formattedStrings = {};
			if(aCustomers.length >0)  {
				aCustomers = aCustomers.replaceAll(/&/g, 'and');
			if (aCustomers.includes("GU:")) {
				aCustomers = aCustomers.replaceAll("GU: ", "");
				formattedStrings.notification_global_ultimate_id = aCustomers;
				this.triggerGlobalUltimatePersistence(aCustomers);
			}

			else {
				aCustomers = aCustomers.replaceAll("ERPNo: ", "");
				formattedStrings.notification_customer_id = aCustomers;
			}
			}
			if(aServiceTeams.length >0) 
			formattedStrings.notification_service_team_id = aServiceTeams.map(team => team.replace(/&/g, 'and'));
			// Combine the formatted strings with '&'
			var filterString = Object.keys(formattedStrings).map(function (key) {
				return key + ' = ' + formattedStrings[key];
				}).join(' & ');

			var oUserID=this.getModel("settings").getProperty("/currentUserID");

		

			if( this._oLocalModel.getProperty("/editedValue")) {
				var bGetTeamsNotification = this._oLocalModel.getProperty("/editedValue").bGetTeamsNotification;
				var bGetMailNotification = this._oLocalModel.getProperty("/editedValue").bGetMailNotification;

			}

			this.oNewRecipient = this.getView().getModel("MCCToolSuite").createEntry("/NotificationSettings", {
				properties: {
					NotificationType: this.getView().byId("NotificationTypeSelect").getSelectedKey(),
					UserID: oUserID,
					Filter: filterString,
					bGetTeamsNotification:  bGetTeamsNotification || false,
					bGetMailNotification: bGetMailNotification || false
				}
			});
			var source = oEvent.getSource().getParent();
			var oModel = this.getView().getModel("MCCToolSuite");
			oModel.submitChanges({
				success: function (aResponse) {		
					aResponse.__batchResponses.forEach((oResponse) => {
						if (oResponse.message === 'HTTP request failed') {
							var oError = JSON.parse(oResponse.response.body).error.message.value;

							if(oError.includes("Unique constraint violated")) {
								oError= "You are trying to insert a duplicated entry. Please change your filter settings."
							}
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

		},

		onDeleteSettingsPress: function() {
            var that = this;
            MessageBox.confirm("Are you sure you want to delete all your settings records?", {
                title: "Confirmation",
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that.deleteSettings();
                    }
                }
            });
        },

        deleteSettings: function() {
			var that = this;
			 this.getView().setBusy(true);

			var mail = this.getModel("settings").getProperty("/currentUserMail");
			var userID = this.getModel("settings").getProperty("/currentUserID");

			var userDetails = {
				Mail: mail,
				UserID: userID
			};


            var oModel = this._oModel;
		
             oModel.callFunction("/deleteUserNotificationSettings", {
                 method: "POST",
				 urlParameters: { UserDetails: JSON.stringify(userDetails) },
                 success: function() {

					MessageBox.show("Settings deleted successfully. You will be forwarded to the home screen. If you open the notification settings again the default user-settings will be initialized.", {
						icon: MessageBox.Icon.SUCCESS,
						title: "Settings deleted",
						actions: [MessageBox.Action.OK],
						onClose: function () {
							that.getRouter().navTo("home");
							that.getView().setBusy(false);
						}
					});
					
                 },
                 error: function() {
                     MessageBox.error("Failed to delete settings");
					 that.getView().setBusy(false);
                 }
             });
        }


	});

});