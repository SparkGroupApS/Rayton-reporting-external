# Plant-Specific Tab Configuration System

This system allows different dashboard tabs to be rendered based on the plant configuration stored in the database. This enables customization of the UI for different plant types (e.g., different ESS capacities, solar configurations, etc.).

## How It Works

1. The `PLANT_LIST` table in the database has a `tab_config` column that stores JSON configuration
2. The configuration specifies which component to render for each tab type
3. The `TabRenderer` component fetches the configuration and renders the appropriate component

## Configuration Format

The `tab_config` field should contain a JSON string with the following format:

```json
{
  "schedule": "ScheduleTab_light",
  "ess": "ESSTab_advanced",
  "smartlogger": "Smartlogger",
  "plcontrol": "PLCControl"
}
```

## Available Components

### Schedule Tab Components
- `ScheduleTab` - Default schedule tab
- `ScheduleTab_light` - Simplified schedule tab
- `ScheduleTab_full` - Advanced schedule tab with more features

### ESS Tab Components
- `ESS` - Default ESS tab
- `ESSTab_basic` - Simplified ESS tab
- `ESSTab_advanced` - Advanced ESS tab with more metrics

### Other Tab Components
- `Smartlogger` - Default Smartlogger tab
- `PLCControl` - Default PLC Control tab

## Example Configurations

### Plant 2502: Simple Schedule, 100ah ESS, No Solar
```json
{
  "schedule": "ScheduleTab_light",
  "ess": "ESSTab_basic",
  "smartlogger": "Smartlogger",
  "plcontrol": "PLCControl"
}
```

### Plant 2506: Complex Schedule, 400ah ESS, Two Solar Fields
```json
{
  "schedule": "ScheduleTab_full",
  "ess": "ESSTab_advanced",
  "smartlogger": "Smartlogger",
  "plccontrol": "PLCControl"
}
```

## Implementation Details

- The system uses the existing `usePlant` hook from `usePlantQueries.ts` to fetch plant configuration
- The `TabRenderer` component dynamically renders the appropriate component based on the configuration
- If no configuration is found or there's an error, the system falls back to default components
- All configuration is stored in the `PLANT_LIST` table in the `tab_config` column

## Adding New Tab Variations

To add new tab variations:

1. Create a new component in the appropriate variation folder (e.g., `ScheduleTabVariations/MyNewScheduleTab.tsx`)
2. Import the new component in `TabRenderer.tsx`
3. Add a new case to the `renderComponent` function in `TabRenderer.tsx`
4. Update the database configuration to use the new component name
