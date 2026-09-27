import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import {
  CATEGORY_GROUP_IDS,
  CATEGORY_GROUPS,
  CATEGORY_IDS,
  getCategoryById,
  isSupportedCategoryId,
  PROFESSIONAL_CATEGORIES,
} from '../professional-categories';

describe('professional categories catalog', () => {
  it('defines every category id exactly once, in id order', () => {
    expect(PROFESSIONAL_CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(new Set(CATEGORY_IDS).size).toBe(CATEGORY_IDS.length);
  });

  it('assigns every category to a known group', () => {
    const groupIds = new Set(CATEGORY_GROUPS.map((g) => g.id));
    expect([...groupIds].sort()).toEqual([...CATEGORY_GROUP_IDS].sort());
    for (const category of PROFESSIONAL_CATEGORIES) {
      expect(groupIds.has(category.groupId)).toBe(true);
    }
  });

  it('provides English and Hebrew names, descriptions and keywords', () => {
    for (const category of PROFESSIONAL_CATEGORIES) {
      expect(category.name.en.trim()).not.toBe('');
      expect(category.name.he.trim()).not.toBe('');
      expect(category.description?.en).toBeTruthy();
      expect(category.description?.he).toBeTruthy();
      expect(category.keywords.en.length).toBeGreaterThan(0);
      expect(category.keywords.he.length).toBeGreaterThan(0);
    }
  });

  it('uses icons that exist in the icon set', () => {
    const icons = [...PROFESSIONAL_CATEGORIES.map((c) => c.icon), ...CATEGORY_GROUPS.map((g) => g.icon)];
    for (const icon of icons) {
      expect(glyphMap).toHaveProperty(icon);
    }
  });

  it('covers the required service categories', () => {
    const required = [
      'plumbing', 'electrical', 'hvac', 'appliance_repair', 'handyman', 'painting', 'carpentry',
      'furniture_assembly', 'locksmith', 'glass_window_repair', 'door_shutter_repair', 'roofing',
      'waterproofing_leak_detection', 'flooring_tiling', 'plastering_drywall', 'pest_control', 'cleaning',
      'home_maintenance', 'general_contractor', 'masonry', 'renovation', 'kitchen_renovation',
      'bathroom_renovation', 'welding', 'ironwork', 'aluminum_work', 'insulation', 'landscaping_gardening',
      'tree_services', 'pool_maintenance', 'moving', 'truck_moving', 'furniture_transport', 'delivery',
      'junk_removal', 'heavy_lifting', 'packing_unpacking', 'vehicle_towing', 'computer_it_repair',
      'network_wifi_setup', 'security_systems', 'solar_panels', 'water_filtration', 'window_cleaning',
      'upholstery_cleaning', 'carpet_cleaning', 'chimney_vent_cleaning',
    ];
    for (const id of required) expect(isSupportedCategoryId(id)).toBe(true);
  });

  it('rejects arbitrary profession names and display names', () => {
    expect(isSupportedCategoryId('Plumbing')).toBe(false);
    expect(isSupportedCategoryId('astrologer')).toBe(false);
    expect(isSupportedCategoryId('')).toBe(false);
    expect(isSupportedCategoryId(42)).toBe(false);
    expect(getCategoryById('not_a_category')).toBeUndefined();
    expect(getCategoryById('plumbing').name.en).toBe('Plumbing');
  });
});
