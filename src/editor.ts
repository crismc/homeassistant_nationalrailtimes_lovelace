/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, css, CSSResultGroup } from 'lit';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';

import { ScopedRegistryHost } from '@lit-labs/scoped-registry-mixin';
import { NationalrailTimesCardConfig } from './types';
import { customElement, property, state } from 'lit/decorators';
import { formfieldDefinition } from '../elements/formfield';
import { selectDefinition } from '../elements/select';
import { switchDefinition } from '../elements/switch';
import { textfieldDefinition } from '../elements/textfield';
import { THEME } from './const';

@customElement('nationalrail-times-card-editor')
export class NationalrailTimesCardEditor extends ScopedRegistryHost(LitElement) implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: NationalrailTimesCardConfig;

  @state() private _helpers?: any;

  private _initialized = false;

  static elementDefinitions = {
    ...textfieldDefinition,
    ...selectDefinition,
    ...switchDefinition,
    ...formfieldDefinition,
  };

  public setConfig(config: NationalrailTimesCardConfig): void {
    this._config = config;
    this.loadCardHelpers();
  }

  protected shouldUpdate(): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    return true;
  }

  private _getConfig(prop, defaultVal): any {
    if (this._config && prop in this._config) {
      return this._config[prop];
    }
    return defaultVal
  }

  get _name(): string {
    return this._getConfig('name', '');
  }

  get _entity(): string {
    return this._getConfig('entity', '');
  }

  get _theme(): string {
    return this._getConfig('theme', THEME.DEFAULT);
  }

  get _show_warning(): boolean {
    return this._getConfig('show_warning', true);
  }

  get _show_error(): boolean {
    return this._getConfig('show_error', true);
  }

  get _show_via_destination(): boolean {
    return this._getConfig('show_via_destination', true);
  }

  get _show_callingpoints(): boolean {
    return this._getConfig('show_callingpoints', true);
  }

  get _show_status(): boolean {
    return this._getConfig('show_status', true);
  }

  get _show_arrival_time(): boolean {
    return this._getConfig('show_arrival_time', true);
  }

  get _show_departure_time(): boolean {
    return this._getConfig('show_departure_time', true);
  }

  get _show_lastupdated(): boolean {
    return this._getConfig('show_lastupdated', true);
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._helpers) {
      return html``;
    }

    // You can restrict on domain type
    const entities = Object.keys(this.hass.states).filter((entity) => entity.indexOf('sensor.trains_') === 0);
    const themes = Object.values(THEME);

    return html`
      <mwc-select
        naturalMenuWidth
        fixedMenuPosition
        label="Entity (Required)"
        .configValue=${'entity'}
        .value=${this._entity}
        @selected=${this._valueChanged}
        @closed=${(ev) => ev.stopPropagation()}
      >
        ${entities.map((entity) => {
          return html`<mwc-list-item .value=${entity}>${entity}</mwc-list-item>`;
        })}
      </mwc-select>
      <mwc-textfield
        label="Name (Optional)"
        .value=${this._name}
        .configValue=${'name'}
        @input=${this._valueChanged}
      ></mwc-textfield>
      <mwc-select
        naturalMenuWidth
        fixedMenuPosition
        label="Theme (Required)"
        .configValue=${'theme'}
        .value=${this._theme}
        @selected=${this._valueChanged ? this._valueChanged : 'Default'}
        @closed=${(ev) => ev.stopPropagation()}
      >
        ${themes.map((theme) => {
          return html`<mwc-list-item .value=${theme.toLowerCase()}>${theme}</mwc-list-item>`;
        })}
      </mwc-select>
      <mwc-formfield .label=${`Toggle station messages ${this._show_warning ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_warning !== false}
          .configValue=${'show_warning'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle error ${this._show_error ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_error !== false}
          .configValue=${'show_error'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle Via Destination ${this._show_via_destination ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_via_destination !== false}
          .configValue=${'show_via_destination'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle Train Status ${this._show_status ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_status !== false}
          .configValue=${'show_status'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle Train Arrival Time ${this._show_arrival_time ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_arrival_time !== false}
          .configValue=${'show_arrival_time'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle Train Departure Time ${this._show_departure_time ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_departure_time !== false}
          .configValue=${'show_departure_time'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle calling points ${this._show_callingpoints ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_callingpoints !== false}
          .configValue=${'show_callingpoints'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Toggle last updated ${this._show_lastupdated ? 'off' : 'on'}`}>
        <mwc-switch
          .checked=${this._show_lastupdated !== false}
          .configValue=${'show_lastupdated'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
    `;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private _valueChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (this[`_${target.configValue}`] === target.value) {
      return;
    }
    if (target.configValue) {
      if (target.value === '') {
        const tmpConfig = { ...this._config };
        delete tmpConfig[target.configValue];
        this._config = tmpConfig;
      } else {
        this._config = {
          ...this._config,
          [target.configValue]: target.checked !== undefined ? target.checked : target.value,
        };
      }
    }
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static styles: CSSResultGroup = css`
    mwc-select,
    mwc-textfield {
      margin-bottom: 16px;
      display: block;
    }
    mwc-formfield {
      padding-bottom: 8px;
      display: block;
    }
    mwc-switch {
      --mdc-theme-secondary: var(--switch-checked-color);
    }
  `;
}
