/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, css, PropertyValues, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers

import type { NationalrailTimesCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { THEME } from './const';
import { localize } from './localize/localize';

// This puts the card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'nationalrail-times-card',
  name: 'National Rail Times Card',
  description: 'A custom template to present departure details from a configured station enabled from the National Rail Departure Times Integration',
});

const STATUS = {
  SUCCESS : 'success',
  WARNING : 'warning',
  ERROR : 'error'
}

@customElement('nationalrail-times-card')
export class NationalrailTimesCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('nationalrail-times-card-editor');
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private config!: NationalrailTimesCardConfig;

  public setConfig(config: NationalrailTimesCardConfig): void {
    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this.config = {
      show_theme: THEME.DEFAULT,
      show_warning: true,
      show_error: true,
      show_via_destination: true,
      show_callingpoints: true,
      show_status: true,
      show_arrival_time: true,
      show_departure_time: true,
      show_lastupdated: true,
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    }

    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected getEntity(entityName): any | void {
    if (this.hass && entityName in this.hass.states) {
      return this.hass.states[entityName];
    }
  }

  isCancelled(attribs):boolean|void {
    if (!attribs?.service) {
      return true;
    }
    
    const status = attribs.service.etd;
    const state = !attribs.calling_points || !(status !== "Cancelled" && attribs.calling_points !== undefined);
    return state;
  }

  isDelayed(service): boolean|void {
    if (!service) {
      return;
    }
    // If the train is on time, etd would display "On Time"
    const re = /[0-9]/i;
    const status = service.etd || "";
    return status.match(re);
  }

  formatTime(time): string {
    return time.replace("_", ":");
  }

  getTimeDiff(from, to): number {
    const fromDate = new Date('2000.1.1 ' + from);
    let toDate = new Date('2000.1.1 ' + to);

    if (toDate < fromDate) {
        toDate = new Date('2000.1.2 ' + to);
    }

    const diff = toDate.getTime() - fromDate.getTime();
    return (diff / 1000) / 60;
  }

  destinationVia(service): string | void {
    if (service?.destination && service.destination?.location && service.destination.location?.via) {
      return service.destination.location.via;
    }
  }

  departureTime(entity): string | void {
    if (this.isCancelled(entity)) {
      return;
    }

    const service = entity.service;

    if (!service) {
      return;
    }

    let time = service.std;
    if (this.isDelayed(service)) {
      time = service.etd;
    }

    return this.formatTime(time);
  }

  arrivalTime(entity): string | void {
    if (this.isCancelled(entity)) {
      return;
    }

    const callingPoints = entity?.calling_points || [];
    const indexes = callingPoints.length;
    if (indexes) {
      const destination_stop = callingPoints.find(point => point.crs === entity.target_station_code);
      if (destination_stop) {
        return this.formatTime(destination_stop.st);
      }
      console.log('National Rail API didn\'t respond with target destination. Why did this even return?')
      const lastStop = callingPoints[indexes - 1];
      return this.formatTime(lastStop.st);
    }
  }

  stationMessage(entity): TemplateResult | void {
    if (this.config.show_warning && entity.message) {
      const message = entity.message.replace('this station', entity.station_name + ' station');
      return html`<div class="messages">${this._showWarning(message)}</div>`;
    }
  }

  getStatus(attribs): string {
    let alertType = STATUS.SUCCESS;
    if (this.isCancelled(attribs)) {
      alertType = STATUS.ERROR;
    } else if (this.isDelayed(attribs) || !attribs?.service) {
      alertType = STATUS.WARNING;
    }

    return alertType;
  }

  protected _renderServiceStatus(entity, renderer = THEME.DEFAULT): TemplateResult | void {
    if (!this.config.show_status) {
      return;
    }

    const alertType = this.getStatus(entity);

    const render = function(self, entity){
      return self.isDelayed(entity.service) ?
        html`Delayed (<span class="delayed">${self.formatTime(entity.service.std)}</span>)`
        :
        entity?.service ? entity.service.etd : "Service Suspended"
    }

    return html`
    <div class="status ${alertType}">
      ${renderer == THEME.DEFAULT ?
        html`<ha-alert alert-type="${alertType}">${render(this, entity)}</ha-alert>` :
        render(this, entity)
      }
    </div>`;
  }

  protected _renderServiceTimes(entity): TemplateResult | void {
    if (this.isCancelled(entity) || !entity.service) {
      return;
    }

    let arrival, departure;
    if (this.config.show_departure_time) {
      departure = html`
      <div class="train-times__col">
        <div class="train-times__title">Departs</div>
        <div class="train-times__time">${this.departureTime(entity)}</div>
      </div>`;
    }
    if (this.config.show_arrival_time) {
      arrival = html`
      <div class="train-times__col">
        <div class="train-times__title">Arrives</div>
        <div class="train-times__time">${this.arrivalTime(entity)}</div>
      </div>`;
    }
    if (arrival || departure) {
      return html`<div class="train-times">
        ${departure}
        ${arrival}
      </div>`;
    }
  }

  protected _renderCallingPoints(entity): TemplateResult | void {
    if (this.isCancelled(entity) || !this.config.show_callingpoints || !entity?.calling_points) {
      return;
    }
    let departureStopIndex = null;
    let targetStopIndex = null;

    const renderStop = function(isHighlightedStop, innerHtml): TemplateResult {
      return html`
        <div class="calling-point ${isHighlightedStop ? 'arrival_stop':null}">
          ${innerHtml}
        </div>
        `
    };

    const departureStopInPoints = entity.calling_points.find(stop => stop.crx == entity.station_code);

    const callingStops = entity.calling_points.map((stop, index) => {
      const isDepartureStop = stop.crs == entity.station_code;
      const isTargetStop = stop.crs == entity.target_station_code;
      if (isDepartureStop) departureStopIndex = index;
      if (isTargetStop) targetStopIndex = index;
      const isLastStop = entity.calling_points.length - 1 == index;

      if (targetStopIndex && index > targetStopIndex && !isLastStop) {
        return;
      }

      return html`
        ${isLastStop ? renderStop(isTargetStop, html`
          <ha-icon class="arrow" icon="mdi:arrow-right"></ha-icon>
          <div class="calling-points__time">...</div>
        `) : null}

        ${renderStop(isTargetStop || isDepartureStop, html`
          ${index > 0 || !departureStopInPoints ? html`<ha-icon class="arrow" icon="mdi:arrow-right"></ha-icon>`:null}
          <div class="calling-points__stop">${stop.locationName}</div>
          <div class="calling-points__time">(${stop.st})</div>
        `)}
      `;
    });

    const originLocation = entity?.service && entity.service?.origin && entity.service.origin?.location && entity.service.origin.location.locationName ? entity.service.origin.location.locationName : null;
    
    if (originLocation) {
      callingStops.unshift(renderStop(!departureStopIndex, html`
        <div class="calling-points__stop">${originLocation}</div>
        <div class="calling-points__time">(${this.departureTime(entity)})</div>
      `));
    }

    return html`<div class="calling-points">
      <!-- <div class="calling-points__title">Calling At</div> -->
      <div class="calling-points_container">
        <marquee>
          <div class="calling-point_items">
            ${callingStops}
          </div>
        </marquee>
      </div>
    </div>`;
  }

  protected _renderLastUpdated(): TemplateResult | void {
    const entity = this.getEntity(this.config.entity);
    if (entity && entity.last_updated) {
      const date = new Date(entity.last_updated);
      return html`<div class="last_updated">Last Updated: <span class="date">${date.toLocaleString()}</span></div>`;
    }
  }

  protected _renderErrors(): TemplateResult | void {
    if (!this.config.show_error) {
      return;
    }

    const entity = this.getEntity(this.config.entity);
    const re = /[0-9]/i;

    if (entity.state && entity.state != 'None' && !entity.state.match(re)) {
      return html`<div class="messages">${this._showError(entity.state)}</div>`
    }
  }

  protected renderDefaultTheme(entity): TemplateResult | void {
    return html`
      <div class="title">
        <ha-icon class="title_icon" icon="mdi:bus-clock"></ha-icon>
        <div class="title_inner">
          ${this.config.name ? this.config.name : entity ? entity.attributes.friendly_name : "National Rail"}
          ${this.config.show_via_destination ? html`<div class="via-destination">${this.destinationVia(entity.attributes.service)}</div>` : null}
        </div>
      </div>
      ${this._renderErrors()}
      ${this.stationMessage(entity.attributes)}
      ${this._renderServiceStatus(entity.attributes, THEME.DEFAULT)}
      ${this._renderServiceTimes(entity.attributes)}
      ${this._renderCallingPoints(entity.attributes)}
    `;
  }

  protected renderThinTheme(entity): TemplateResult | void {
    return html`
      <div class="title">
        <ha-icon class="title_icon ${this.getStatus(entity.attributes)}" icon="mdi:bus-clock"></ha-icon>
        <div class="title_inner">
          <div class="title_inner_wrapper">
            <div class="title_inner_wrapper-title">
              ${this.config.name ? this.config.name : entity ? entity.attributes.friendly_name : "National Rail"}
            </div>
            <div class="title_inner_wrapper-status">
              ${this._renderServiceStatus(entity.attributes, THEME.THIN)}
            </div>
          </div>
          ${this.config.show_via_destination ? html`<div class="via-destination">${this.destinationVia(entity.attributes.service)}</div>` : null}
        </div>
      </div>
      ${this._renderErrors()}
      ${this.stationMessage(entity.attributes)}
      <div class="row">
        ${this._renderServiceTimes(entity.attributes)}
        ${this._renderCallingPoints(entity.attributes)}
      </div
    `;
  }

  protected render(): TemplateResult | void {
    const entity = this.getEntity(this.config.entity);
    if (!entity) {
        return;
    }
    console.log(entity);
    return html`
      <ha-card
        @action=${this._handleAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this.config.hold_action),
          hasDoubleClick: hasAction(this.config.double_tap_action),
        })}
        tabindex="0"
        .label=${`National Rail: ${this.config.entity || 'No Entity Defined'}`}
      >
        <div class="card-content ${this.config.theme}_theme">
          ${this.isTheme(THEME.THIN) ? this.renderThinTheme(entity) : this.renderDefaultTheme(entity)}
          ${this.config.show_lastupdated ? html`<div class="content-footer">${this._renderLastUpdated()}</div>` : null}
        </div>
      </ha-card>
    `;
  }

  private isTheme(theme): boolean {
    const configTheme = this.config?.theme || THEME.DEFAULT;
    return configTheme.toLowerCase() === theme.toLowerCase();
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    if (this.hass && this.config && ev.detail.action) {
      handleAction(this, this.hass, this.config, ev.detail.action);
    }
  }

  private _showWarning(warning: string): TemplateResult {
    return html` <hui-warning>${warning}</hui-warning> `;
  }

  private _showError(error: string, showOrigConfig = false): TemplateResult {
    const errorCard = document.createElement('hui-error-card');

    const config = {
      type: 'error',
      error
    };

    if (showOrigConfig) {
      config["origConfig"] = this.config;
    }

    errorCard.setConfig(config);

    return html` ${errorCard} `;
  }

  static get styles(): CSSResultGroup {
    return css`
      .title {
        font-weight: bold;
        display: flex;
        gap: 8px;
      }
      .via-destination {
        padding-bottom: 8px;
        font-weight: normal;
        font-size: smaller;
      }

      .messages {
        margin-bottom: 8px;
      }

      .status {
        font-weight: bold;
        text-transform: uppercase;
      }

      .status .delayed {
        text-decoration:line-through;
        font-weight: normal;
        color: var(--error-color) !important;
      }

      .train-times {
        display: flex;
        gap: 8px;
        align-items: center;
        text-align: center;
        margin-top: 8px;
        position: relative;
        flex-wrap: wrap;
        font-weight: bold;
      }

      .train-times .train-times__time {
        font-weight: normal;
        font-size: larger;
      }

      .train-times .train-times__col {
        border-radius: 5px;
        padding: 8px;
        flex: 1;
      }

      .train-times .train-times__col h2 {
        margin: 0;
        margin-bottom: 8px;
      }

      /* .train-times__time {
        font-size: 2rem;
      } */

      .calling-points {
        margin-top: 8px;
        font-weight: normal;
      }

      .calling-points__title {
        margin-bottom: 6px;
        font-weight: normal;
      }

      .calling-points_container {
        border-radius: 5px;
        padding: 8px;
        padding-bottom: 0;
        margin-bottom: 8px;
      }

      .calling-point_items {
        display: flex;
        gap: 16px;
      }

      .calling-point_items .calling-point {
        display: flex;
        gap: 8px;
      }

      .calling-point_items .calling-point.arrival_stop .calling-points__stop,
      .calling-point_items .calling-point.arrival_stop .calling-points__time {
        color: var(--primary-color);
        font-size: larger;
      }

      .calling-point_items .calling-point .calling-points__stop {
        font-weight: bold;
      }

      .calling-point_items .calling-point .arrow {
        margin-left: -8px;
        --mdc-icon-size: 15px;
      }

      .last_updated {
        text-align: right;
        font-size: 0.8em;
      }

      .last_updated .date {
        font-style: italic;
      }

      /* Colours */
      .title_icon.success,
      .status.success {
        color: var(--label-badge-green);
      }
      .title_icon.error,
      .status.error {
        color: var(--label-badge-red);
      }
      .title_icon.warning,
      .status.warning {
        color: var(--label-badge-yellow);
      }
      .status .delayed {
        color: var(--secondary-text-color);
      }
      .train-times .train-times__col .arrow {
        color: var(--secondary-text-color);
      }
      .train-times .train-times__col,
      .calling-points_container {
        background:var(--input-fill-color);
      }

      /* Themes */
      .thin_theme .title {
        margin-bottom: 4px;
      }
      
      .thin_theme .title_icon {
        --mdc-icon-size: 20px;
      }
      
      .thin_theme .title_inner {
        width: 100%;
      }

      .thin_theme .title_inner_wrapper {
        display: flex;
        gap: 5px;
        justify-content: space-between;
      }
      
      .thin_theme .status_container {
        font-size: 0.8em;
      }

      .thin_theme .row {
        display: flex;
        gap: 5px;
        justify-content: space-between;
        align-items: center;
      }

      .thin_theme .train-times {
        margin-top: 0;
        flex-wrap: nowrap;
        width: 100%;
      }

      .thin_theme .train-times .train-times__col {
        flex-direction: row;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 4px 8px;
        font-size: smaller;
      }

      .thin_theme .train-times .train-times__time {
        font-size: small;
      }

      .thin_theme .calling-points {
        margin-top: 0;
        line-height: normal;
      }

      .thin_theme .calling-points_container {
        background: transparent;
        font-size: smaller;
        padding: 0;
        margin-bottom: 0;
        line-height: normal;
      }
    `;
  }
}
