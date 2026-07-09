import type { ImageSourcePropType } from 'react-native';

import coffeeCafeLayout from '@/data/local-environments/coffee_cafe.json';
import feastleHearthLayout from '@/data/local-environments/feastle_hearth.json';
import type { LocalEnvironmentDefinition, LocalEnvironmentId } from '@/types/local-environment';

const COFFEE_CAFE = coffeeCafeLayout as unknown as LocalEnvironmentDefinition;
const FEASTLE_HEARTH = feastleHearthLayout as unknown as LocalEnvironmentDefinition;

export const LOCAL_ENVIRONMENTS: readonly LocalEnvironmentDefinition[] = [COFFEE_CAFE, FEASTLE_HEARTH];

const LOCAL_ENVIRONMENT_PLATES: Record<string, ImageSourcePropType> = {
  coffee_cafe_base: require('../assets/images/katchimeras/environments/coffee_cafe/base.jpg'),
  feastle_hearth_base: require('../assets/images/katchimeras/environments/feastle_hearth/base.png'),
  feastle_hearth_extracted_base: require('../assets/images/katchimeras/environments/feastle_hearth/review/extracted_base.png'),
};

const LOCAL_ENVIRONMENT_FULL_SCENES: Record<string, ImageSourcePropType> = {
  feastle_hearth_direct_scene: require('../assets/images/katchimeras/environments/feastle_hearth/review/direct_scene.png'),
};

const LOCAL_ENVIRONMENT_REVEAL_OBJECTS: Record<string, ImageSourcePropType> = {
  feastle_hearth_feast_table_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_feast_table_reveal_object.png'),
  feastle_hearth_spice_rack_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_spice_rack_reveal_object.png'),
  feastle_hearth_hearth_pot_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_hearth_pot_reveal_object.png'),
  feastle_hearth_market_map_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_market_map_reveal_object.png'),
  feastle_hearth_photo_menu_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_photo_menu_reveal_object.png'),
  feastle_hearth_dessert_case_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_dessert_case_reveal_object.png'),
  feastle_hearth_quest_board_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_quest_board_reveal_object.png'),
  feastle_hearth_trophy_cupboard_reveal_object: require('../assets/images/katchimeras/environments/feastle_hearth/reveal-objects/feastle_hearth_trophy_cupboard_reveal_object.png'),
};

const LOCAL_ENVIRONMENT_FOREGROUNDS: Record<string, ImageSourcePropType> = {
  coffee_cafe_foreground: require('../assets/images/katchimeras/environments/coffee_cafe/foreground.webp'),
  feastle_hearth_foreground: require('../assets/images/katchimeras/environments/feastle_hearth/foreground.webp'),
};

const LOCAL_ENVIRONMENT_GUIDES: Record<string, ImageSourcePropType> = {
  coffee_cafe_slot_guide: require('../assets/images/katchimeras/environments/coffee_cafe/guide_slots.png'),
  feastle_hearth_slot_guide: require('../assets/images/katchimeras/environments/feastle_hearth/guide_slots.png'),
};

const LOCAL_ENVIRONMENT_PROPS: Record<string, ImageSourcePropType> = {
  coffee_bar_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/coffee_bar_l1.webp'),
  coffee_bar_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/coffee_bar_l2.webp'),
  coffee_bar_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/coffee_bar_l3.webp'),
  bean_shelf_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/bean_shelf_l1.webp'),
  bean_shelf_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/bean_shelf_l2.webp'),
  bean_shelf_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/bean_shelf_l3.webp'),
  travel_map_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/travel_map_l1.webp'),
  travel_map_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/travel_map_l2.webp'),
  travel_map_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/travel_map_l3.webp'),
  photo_wall_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/photo_wall_l1.webp'),
  photo_wall_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/photo_wall_l2.webp'),
  photo_wall_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/photo_wall_l3.webp'),
  recipe_book_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/recipe_book_l1.webp'),
  recipe_book_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/recipe_book_l2.webp'),
  recipe_book_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/recipe_book_l3.webp'),
  notice_board_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/notice_board_l1.webp'),
  notice_board_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/notice_board_l2.webp'),
  notice_board_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/notice_board_l3.webp'),
  trophy_shelf_l1: require('../assets/images/katchimeras/environments/coffee_cafe/props/trophy_shelf_l1.webp'),
  trophy_shelf_l2: require('../assets/images/katchimeras/environments/coffee_cafe/props/trophy_shelf_l2.webp'),
  trophy_shelf_l3: require('../assets/images/katchimeras/environments/coffee_cafe/props/trophy_shelf_l3.webp'),
  feast_table_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/feast_table_l1.png'),
  feast_table_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/feast_table_l2.png'),
  feast_table_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/feast_table_l3.png'),
  spice_rack_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/spice_rack_l1.png'),
  spice_rack_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/spice_rack_l2.png'),
  spice_rack_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/spice_rack_l3.png'),
  hearth_pot_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/hearth_pot_l1.png'),
  hearth_pot_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/hearth_pot_l2.png'),
  hearth_pot_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/hearth_pot_l3.png'),
  market_map_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/market_map_l1.png'),
  market_map_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/market_map_l2.png'),
  market_map_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/market_map_l3.png'),
  photo_menu_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/photo_menu_l1.png'),
  photo_menu_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/photo_menu_l2.png'),
  photo_menu_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/photo_menu_l3.png'),
  dessert_case_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/dessert_case_l1.png'),
  dessert_case_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/dessert_case_l2.png'),
  dessert_case_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/dessert_case_l3.png'),
  quest_board_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/quest_board_l1.png'),
  quest_board_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/quest_board_l2.png'),
  quest_board_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/quest_board_l3.png'),
  trophy_cupboard_l1: require('../assets/images/katchimeras/environments/feastle_hearth/props/trophy_cupboard_l1.png'),
  trophy_cupboard_l2: require('../assets/images/katchimeras/environments/feastle_hearth/props/trophy_cupboard_l2.png'),
  trophy_cupboard_l3: require('../assets/images/katchimeras/environments/feastle_hearth/props/trophy_cupboard_l3.png'),
};

export function localEnvironmentById(id: LocalEnvironmentId): LocalEnvironmentDefinition | null {
  return LOCAL_ENVIRONMENTS.find((environment) => environment.id === id) ?? null;
}

export function localEnvironmentPlateSource(assetKey: string): ImageSourcePropType | null {
  return LOCAL_ENVIRONMENT_PLATES[assetKey] ?? null;
}

export function localEnvironmentFullSceneSource(assetKey: string | undefined): ImageSourcePropType | null {
  return assetKey ? (LOCAL_ENVIRONMENT_FULL_SCENES[assetKey] ?? null) : null;
}

export function localEnvironmentRevealObjectSource(assetKey: string | undefined): ImageSourcePropType | null {
  return assetKey ? (LOCAL_ENVIRONMENT_REVEAL_OBJECTS[assetKey] ?? null) : null;
}

export function localEnvironmentForegroundSource(assetKey: string | undefined): ImageSourcePropType | null {
  return assetKey ? (LOCAL_ENVIRONMENT_FOREGROUNDS[assetKey] ?? null) : null;
}

export function localEnvironmentGuideSource(assetKey: string | undefined): ImageSourcePropType | null {
  return assetKey ? (LOCAL_ENVIRONMENT_GUIDES[assetKey] ?? null) : null;
}

export function localEnvironmentPropSource(assetKey: string | undefined): ImageSourcePropType | null {
  return assetKey ? (LOCAL_ENVIRONMENT_PROPS[assetKey] ?? null) : null;
}
