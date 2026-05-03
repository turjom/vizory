import { Ionicons } from "@expo/vector-icons"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { PlatformPressable } from "@react-navigation/elements"
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { AddSkuScreen } from "@/screens/AddSkuScreen"
import { DashboardScreen } from "@/screens/DashboardScreen"
import { ProfileScreen } from "@/screens/ProfileScreen"
import { SkuListScreen } from "@/screens/SkuListScreen"

import type { MainTabParamList } from "./navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_CONFIG: Record<
  keyof MainTabParamList,
  {
    icon: keyof typeof Ionicons.glyphMap
    iconOutline: keyof typeof Ionicons.glyphMap
    labelTx: string
  }
> = {
  Home: { icon: "home", iconOutline: "home-outline", labelTx: "tabs:dashboard" },
  Inventory: { icon: "clipboard", iconOutline: "clipboard-outline", labelTx: "tabs:inventory" },
  Add: { icon: "add-circle", iconOutline: "add-circle-outline", labelTx: "tabs:add" },
  Profile: { icon: "person", iconOutline: "person-outline", labelTx: "tabs:profile" },
}

export function MainTabNavigator() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name as keyof MainTabParamList]
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            elevation: 0,
            shadowOpacity: 0,
            height: 72,
            paddingBottom: 12,
            paddingTop: 8,
            paddingHorizontal: theme.spacing.md,
            width: "100%",
            flexDirection: "row",
          },
          tabBarItemStyle: {
            flex: 1,
            flexBasis: 0,
            minWidth: 0,
          },
          tabBarButton: (props) => {
            const { style, ...rest } = props
            return (
              <PlatformPressable {...rest} style={[{ flex: 1, minWidth: 0 }, style]} />
            )
          },
          tabBarActiveTintColor: "#F97316",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "500",
            textAlign: "center",
            flexShrink: 1,
          },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? config.icon : config.iconOutline} size={size} color={color} />
          ),
          tabBarLabel: t(config.labelTx),
        }
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={SkuListScreen} />
      <Tab.Screen name="Add" component={AddSkuScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
