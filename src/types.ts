import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'nationalrail-times-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// TODO Add your configuration elements here for type-checking
export interface NationalrailTimesCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;
  show_warning?: boolean;
  show_error?: boolean;
  show_via_destination?: boolean;
  show_callingpoints?: boolean;
  show_status?: boolean;
  show_arrival_time?: boolean;
  show_departure_time?: boolean;
  show_lastupdated?: boolean;
  test_gui?: boolean;
  entities?: Array<string>;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}
