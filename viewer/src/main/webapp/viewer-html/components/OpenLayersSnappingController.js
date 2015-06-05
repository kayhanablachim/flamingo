/*
 * Copyright (C) 2015 B3Partners B.V.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 *  @description Controller component for the Snapping control.
 * @author <a href="mailto:markprins@b3partners.nl">Mark Prins</a>
 *
 * @class
 */
Ext.define("viewer.components.OpenLayersSnappingController", {
    extend: "viewer.components.Component",
    /**
     * editable/drawable OpenLayers Vector layer.
     * @private
     * @TODO refactor to array as each edit & draw control have their own layer
     */
    frameworkLayer: null,
    /** snapping control.*/
    frameworkControl: null,
    config: {
        style: {
            strokeColor: '#FF00FF',
            strokeOpacity: 0.5,
            strokeWidth: 1,
            pointRadius: 1,
            fillOpacity: 0.25,
            fillColor: '#FF00FF'
        },
        viewerController: null
    },
    /**
     * OpenLayers Vector layers to snap to.
     * @private
     */
    snapLayers: [],
    /**
     * name prefix of the built-in snapLayers
     */
    snapLayers_prefix: "snapping_",
    /**
     * OpenLayers Map.
     * @private
     */
    frameworkMap: null,
    /**
     * @constructor
     * @param {Object} config
     * @returns {viewer.viewercontroller.openlayers.OpenLayersSnappingLayer|OpenLayersSnappingControllerAnonym$0.constructor}
     */
    constructor: function (config) {
        viewer.components.OpenLayersSnappingController.superclass.constructor.call(this, config);
        this.frameworkMap = this.config.viewerController.mapComponent.getMap().getFrameworkMap();
        this.frameworkControl = new OpenLayers.Control.Snapping();

        this.config.viewerController.mapComponent.getMap().addListener(
                viewer.viewercontroller.controller.Event.ON_LAYER_ADDED,
                this.layerAdded, this);
        this.config.viewerController.mapComponent.getMap().addListener(
                viewer.viewercontroller.controller.Event.ON_FINISHED_CHANGE_EXTENT,
                this.changedExtent, this);
        // this.config.viewerController.mapComponent.getMap().addListener(
        //         viewer.viewercontroller.controller.Event.ON_LAYER_REMOVED,
        //         this.layerRemoved, this);

        return this;
    },
    //    /**
    //     * @param {type} map
    //     * @param {type} options
    //     * @todo look up the control that belongs to this appLayer and destroy it
    //     */
    //    layerRemoved: function (map, options) {
    //        if (options.layer.getType() !== "VECTOR") {
    //            return;
    //        }
    //        // assume we now have a drawing or editing layer
    //        //this.getlayerName(options.layer.appLayerId);
    //    },
    /**
     * attach the snapping control to the Openlayers layers of the added editing or drawing layer.
     * @param {type} map
     * @param {type} options
     */
    layerAdded: function (map, options) {
        if (options.layer.getType() !== "VECTOR") {
            return;
        }
        // filter for edit and drawing control layers
        if ((Ext.String.startsWith(options.layer.name, "drawing", true)) ||
                (Ext.String.startsWith(options.layer.name, "edit", true)) ||
                (Ext.String.startsWith(options.layer.name, "split", true))) {
            // assume we now have a drawing or editing layer
            this.frameworkLayer = options.layer.getFrameworkLayer();
            this.frameworkControl.setLayer(this.frameworkLayer);
            this.activate();
        }
    },
    /**
     * add the snapping target.
     * @param {type} snappingLayer
     */
    addLayerDataFor: function (appLayer) {
        var me = this;
        // lookup feature source
        var featureService = this.config.viewerController.getAppLayerFeatureService(appLayer);
        // find geom attribute
        featureService.loadAttributes(appLayer, function (result) {
            var geomAttribute = appLayer.attributes[appLayer.geometryAttributeIndex].name;
            var extent = me.viewerController.mapComponent.getMap().getExtent();
            // fetch/load geometries
            featureService.loadFeatures(
                    appLayer,
                    me.parseFeatures,
                    undefined, {
                        store: 1,
                        limit: 1000,
                        arrays: 1,
                        // just get geometry
                        attributesToInclude: [geomAttribute],
                        edit: false,
                        graph: true,
                        // only for map extent
                        filter: "INTERSECTS(" + geomAttribute + ", " + extent.toWKT() + ")"
                    }, {
                /* we need access to appLayer.id and this in processing the response */
                me: me,
                appLayer: appLayer
            });
        });
    },
    /**
     * remove the snapping target.
     * @param {type} snappingLayer
     */
    removeLayer: function (appLayer) {
        this.deactivate();
        //look up snappingLayer primitive by name/id...
        var rLyr = this.frameworkMap.getLayersByName(this.getlayerName(appLayer));
        // there should only be one layer in the rLyr
        rLyr = rLyr[0];
        Ext.Array.remove(this.snapLayers, rLyr);
        this.frameworkMap.removeLayer(rLyr);
        this.frameworkControl.removeTargetLayer(rLyr);
        this.activate();
    },
    /**
     * remove all snapping targets.
     */
    removeAll: function () {
        for (var i = 0; i < this.snapLayers.length; i++) {
            this.frameworkControl.removeTargetLayer(this.snapLayers[i]);
            this.frameworkMap.removeLayer(this.snapLayers[i]);
        }
        this.snapLayers = [];
        this.deactivate();
    },
    /**
     * activate snapping, if there are snapping targets
     */
    activate: function () {
        if (this.snapLayers.length > 0) {
            this.frameworkControl.activate();
        }
    },
    /**
     * deactivate snapping.
     */
    deactivate: function () {
        this.frameworkControl.deactivate();
    },
    parseFeatures: function (data) {
        // note the scope here! "this" is actually not "me" but a composite of "me" and "appLayer"
        var geometryAttributeIndex = this.appLayer.geometryAttributeIndex;
        var lName = this.me.getlayerName(this.appLayer);
        var rLyrs = this.me.frameworkMap.getLayersByName(lName);
        var olLyr;
        if (rLyrs.length > 0) {
            // there should only be one layer in the rLyr
            olLyr = rLyrs[0];
            olLyr.removeAllFeatures();
        } else {
            // create a primitive OL vector layer
            olLyr = new OpenLayers.Layer.Vector(
                    lName, {
                        styleMap: new OpenLayers.StyleMap({
                            'default': this.me.config.style
                        })
                    }
            );
            this.me.snapLayers.push(olLyr);
            this.me.frameworkMap.addLayers([olLyr]);
            this.me.frameworkControl.addTargetLayer(olLyr);
        }

        var feats = [];
        var olGeom, wkt;
        data.forEach(function (element, index, array) {
            // test for keys in element, some WFS just return all attributes anyway..
            if (Object.keys(element).length > 1) {
                wkt = element[Object.keys(element)[geometryAttributeIndex]];
            } else {
                wkt = element[Object.keys(element)[0]];
            }
            olGeom = OpenLayers.Geometry.fromWKT(wkt);
            olGeom.calculateBounds();
            feats.push(new OpenLayers.Feature.Vector(olGeom));
        });
        olLyr.addFeatures(feats);
        this.me.activate();
    },
    /**
     * update data after map extent change.
     * @param {type} map
     * @param {type} options
     * @param {type} extent
     */
    changedExtent: function (map, extent) {
        for (var i = 0; i < this.snapLayers.length; i++) {
            this.addLayerDataFor(this.getAppLayer(this.snapLayers[i].name));
        }
    },
    /**
     *
     * @param {type} appLayer
     * @returns {String} local layer name
     * @see getAppLayer
     */
    getlayerName: function (appLayer) {
        return this.snapLayers_prefix + appLayer.id;
    },
    /**
     *
     * @param {type} name local name
     * @returns {OpenLayersSnappingControllerAnonym$0@pro;config@pro;viewerController@call;getAppLayerById}
     *
     * @see getlayerName
     */
    getAppLayer: function (name) {
        var id = name.substring(this.snapLayers_prefix.length);
        return (this.config.viewerController.getAppLayerById(id));
    }
});
