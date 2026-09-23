import { Check, Pipette } from 'lucide-react'
import { normalizeHexColor, readableColorForeground } from './color'

const colorPresets = [
  { name: 'Red', value: '#D95757' },
  { name: 'Orange', value: '#E47746' },
  { name: 'Amber', value: '#D49B2E' },
  { name: 'Green', value: '#548B5B' },
  { name: 'Teal', value: '#328E89' },
  { name: 'Cyan', value: '#3B95A8' },
  { name: 'Blue', value: '#4C73C9' },
  { name: 'Indigo', value: '#5868C8' },
  { name: 'Violet', value: '#7D64C6' },
  { name: 'Purple', value: '#965FB1' },
  { name: 'Pink', value: '#D34F82' },
]

type ActivityColorPickerProps = {
  activityName: string
  value: string
  inputValue: string
  showError: boolean
  onInputValueChange: (value: string) => void
  onSelect: (value: string) => void
}

export function ActivityColorPicker({ activityName, value, inputValue, showError, onInputValueChange, onSelect }: ActivityColorPickerProps) {
  const normalizedInput = normalizeHexColor(inputValue)
  const previewColor = normalizedInput ?? value
  const validationError = (showError || inputValue.trim().length > 0) && !normalizedInput

  return <fieldset className="activity-color-picker">
    <legend>Color</legend>
    <div className="activity-color-preview" aria-label={`Color preview for ${activityName || 'activity'}`}>
      <span className="activity-color-preview-swatch" style={{ backgroundColor: previewColor }} aria-hidden="true" />
      <span className="activity-color-preview-copy"><strong>Preview</strong><code>{previewColor}</code></span>
      <span className="activity-color-preview-chip" style={{ backgroundColor: previewColor, color: readableColorForeground(previewColor) }}>{activityName.trim() || 'Activity'}</span>
    </div>

    <div className="activity-color-presets" aria-label="Color presets">
      {(colorPresets.some(preset => preset.value === previewColor) ? colorPresets : [{ name: 'Current', value: previewColor }, ...colorPresets]).map(({ name, value: presetColor }) => {
        const selected = previewColor === presetColor
        return <button
          className={`activity-color-preset ${selected ? 'selected' : ''}`}
          key={name}
          type="button"
          aria-label={`${name} ${presetColor}`}
          aria-pressed={selected}
          onClick={() => onSelect(presetColor)}
        >
          <span style={{ backgroundColor: presetColor, color: readableColorForeground(presetColor) }}>
            {selected && <Check aria-hidden="true" />}
          </span>
        </button>
      })}
    </div>

    <label className="activity-color-native-picker">
      <span className="activity-color-native-icon"><Pipette aria-hidden="true" /></span>
      <span><strong>Choose a color</strong><small>Open the full color picker</small></span>
      <input type="color" aria-label="Choose a custom color" value={previewColor} onChange={event => onSelect(normalizeHexColor(event.target.value) ?? value)} />
    </label>

    <label className="activity-hex-field" htmlFor="activity-hex-value">
      <span>HEX value</span>
      <input
        id="activity-hex-value"
        type="text"
        aria-label="HEX value"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={7}
        placeholder="#6366F1"
        value={inputValue}
        aria-invalid={validationError}
        aria-describedby="activity-hex-help"
        onChange={event => onInputValueChange(event.target.value)}
      />
      <small id="activity-hex-help" aria-live="polite">{validationError ? 'Enter a 3- or 6-digit HEX color.' : 'Use #RRGGBB or the short #RGB form.'}</small>
    </label>
  </fieldset>
}
