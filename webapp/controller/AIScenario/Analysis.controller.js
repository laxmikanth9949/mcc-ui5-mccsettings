sap.ui.define([
    "mcc/workbench/admin/settings/controller/BaseController",
    "mcc/workbench/admin/settings/model/formatter",
    'sap/f/library',
    "sap/m/MessageToast"
], function (BaseController, formatter, fioriLibrary, MessageToast) {
    "use strict";

    return BaseController.extend("mcc.workbench.admin.settings.controller.AIScenario.Analysis", {
        formatter: formatter,
        onInit: function () {
            this.getView().byId("feedbackTable");
            this._oModel = this.getModel("MCCAIManagerService");
        },

        handleLinkPress() {
            const oLocalModel = this.getModel("local");
            const dataID = oLocalModel.getProperty("/dataID");

            const sURL = window.location.href;
            let baseURL, itsmURL;

            if (sURL.includes("prod")) {
                baseURL = `https://sapit-home-prod-004.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display&/Customer/${dataID}`;
                itsmURL = `https://itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/${dataID}`;
            } else if (sURL.includes("test")) {
                baseURL = `https://sapit-home-test-004.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display&/Customer/${dataID}`;
                itsmURL = `https://test.itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/${dataID}`;
            } else {
                baseURL = `https://sapit-customersupport-dev-mallard.launchpad.cfapps.eu10.hana.ondemand.com/site#mcconedashboard-Display${dataID}`;
                itsmURL = `https://dev.itsm.services.sap/now/cwf/agent/record/sn_customerservice_escalation/${dataID}`;
            }

            if (/^\d+$/.test(dataID)) {
                sap.m.URLHelper.redirect(baseURL, true);
            } else if (/^[0-9a-fA-F]{32}$/.test(dataID)) {
                sap.m.URLHelper.redirect(itsmURL, true);
            }
        },

        handleFlag() {
            const oButton = this.byId("processedFlagButton");
            const sCurrentType = oButton.getType();
            const sNewType = sCurrentType === "Emphasized" ? "Transparent" : "Emphasized";
            oButton.setType(sNewType);

            const localModel = this.getModel("local");
            const processedFlag = localModel.getData().processedFlag;
            const context = this.getView().getBindingContext("MCCAIManagerService");

            context.setProperty("processed", !processedFlag);

            const oModel = this.getOwnerComponent().getModel("MCCAIManagerService");
            if (oModel.hasPendingChanges()) {
                oModel.submitBatch("$auto")
                    .then(() => MessageToast.show("Changes saved successfully"))
                    .catch(oError => MessageToast.show(`Save operation failed: ${oError.message}`));
            }
        },

        navToAIManager: function () {
            this.getRouter().navTo("AIManager");
        },

        handleClose: function () {
            var oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
        }
    });
});