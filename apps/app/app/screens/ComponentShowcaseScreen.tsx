import { FC, useState, memo, useCallback } from "react"
import { View, ScrollView, useWindowDimensions, Platform, Switch as RNSwitch } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { UnistylesRuntime } from "react-native-unistyles"

import {
  Text,
  Button,
  Card,
  TextField,
  Avatar,
  Badge,
  Divider,
  Spinner,
  IconButton,
  Container,
  Progress,
  Skeleton,
  SkeletonGroup,
  SkeletonCard,
  SkeletonListItem,
  SkeletonParagraph,
  AnimatedCard,
  Tabs,
  ListItem,
  EmptyState,
  // Charts
  LineChart,
  BarChart,
  PieChart,
  // Form inputs
  DatePicker,
  FilePicker,
  // Toggle controls
  Checkbox,
  Radio,
  Switch,
  // Modals
  Modal,
  AlertModal,
  // Business components
  PricingCard,
  SubscriptionStatus,
} from "@/components"
import { ANIMATION } from "@/config/constants"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { webDimension } from "@/types/webStyles"

// =============================================================================
// TYPES
// =============================================================================

interface ComponentShowcaseScreenProps extends AppStackScreenProps<"ComponentShowcase"> {}

// =============================================================================
// CONSTANTS
// =============================================================================

const CONTENT_MAX_WIDTH = 800

// =============================================================================
// SHOWCASE CONTENT PROPS
// =============================================================================

interface ShowcaseContentProps {
  inputValue: string
  setInputValue: (value: string) => void
  isLoading: boolean
  simulateLoading: () => void
  progress: number
  incrementProgress: () => void
  activeTab: string
  setActiveTab: (tab: string) => void
  switchValue: boolean
  setSwitchValue: (value: boolean) => void
  checkboxValue: boolean
  setCheckboxValue: (value: boolean) => void
  radioValue: string
  setRadioValue: (value: string) => void
  selectedDate: Date | undefined
  setSelectedDate: (date: Date | undefined) => void
  selectedFiles: Array<{ uri: string; name: string; type: string; size?: number }>
  setSelectedFiles: (
    files: Array<{ uri: string; name: string; type: string; size?: number }>,
  ) => void
  selectedDocuments: Array<{ uri: string; name: string; type: string; size?: number }>
  setSelectedDocuments: (
    docs: Array<{ uri: string; name: string; type: string; size?: number }>,
  ) => void
  onOpenModal: () => void
  onOpenAlertModal: () => void
}

// =============================================================================
// SHOWCASE CONTENT (MEMOIZED)
// =============================================================================

const ShowcaseContent = memo(function ShowcaseContent(props: ShowcaseContentProps) {
  const {
    inputValue,
    setInputValue,
    isLoading,
    simulateLoading,
    progress,
    incrementProgress,
    activeTab,
    setActiveTab,
    switchValue,
    setSwitchValue,
    checkboxValue,
    setCheckboxValue,
    radioValue,
    setRadioValue,
    selectedDate,
    setSelectedDate,
    selectedFiles,
    setSelectedFiles,
    selectedDocuments,
    setSelectedDocuments,
    onOpenModal,
    onOpenAlertModal,
  } = props

  const { theme } = useUnistyles()

  return (
    <View style={styles.contentContainer}>
      {/* Typography Section */}
      <Section title="Typography">
        <Text preset="heading">Heading Text</Text>
        <Text preset="subheading">Subheading Text</Text>
        <Text>Default body text</Text>
        <Text preset="caption">Caption text</Text>
        <Text color="secondary">Secondary color text</Text>
        <Text color="error">Error color text</Text>
        <Text color="success">Success color text</Text>
        <Text color="link">Link color text</Text>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Buttons Section */}
      <Section title="Buttons">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          With haptic feedback and smooth press animations
        </Text>
        <View style={styles.buttonRow}>
          <Button text="Filled" variant="filled" size="md" />
          <Button text="Secondary" variant="secondary" />
          <Button text="Outlined" variant="outlined" />
        </View>
        <View style={styles.buttonRow}>
          <Button text="Ghost" variant="ghost" />
          <Button text="Danger" variant="danger" />
          <Button text="Disabled" disabled />
        </View>
        <View style={styles.buttonRow}>
          <Button text="Small" size="sm" />
          <Button text="Medium" size="md" />
          <Button text="Large" size="lg" />
        </View>
        <View style={styles.buttonRow}>
          <Button text="Loading" loading={isLoading} onPress={simulateLoading} />
          <Button
            text="With Icon"
            LeftAccessory={() => (
              <Ionicons name="star" size={16} color={theme.colors.primaryForeground} />
            )}
          />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Icon Buttons Section */}
      <Section title="Icon Buttons">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Perfect for toolbars and actions
        </Text>
        <View style={styles.iconButtonRow}>
          <IconButton icon="heart" variant="filled" />
          <IconButton icon="settings" variant="outlined" />
          <IconButton icon="share-outline" variant="ghost" />
          <IconButton icon="add" variant="filled" size="sm" />
          <IconButton icon="close" variant="ghost" size="lg" />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Tabs Section */}
      <Section title="Tabs">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Animated indicator with haptic feedback
        </Text>
        <Tabs
          tabs={[
            { key: "overview", title: "Overview" },
            { key: "settings", title: "Settings" },
            { key: "activity", title: "Activity", badge: 3 },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          fullWidth
        />
        <View style={styles.tabContent}>
          <Text color="secondary">
            Active tab: <Text weight="semiBold">{activeTab}</Text>
          </Text>
        </View>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Underline variant:
        </Text>
        <Tabs
          variant="underline"
          tabs={[
            { key: "tab1", title: "Tab 1" },
            { key: "tab2", title: "Tab 2" },
            { key: "tab3", title: "Tab 3" },
          ]}
          activeTab={activeTab === "overview" ? "tab1" : "tab2"}
          onTabChange={() => {}}
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Progress Section */}
      <Section title="Progress Indicators">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Animated progress bars with spring physics
        </Text>
        <View style={styles.progressItem}>
          <View style={styles.progressHeader}>
            <Text size="sm">Default</Text>
            <Text size="sm" weight="semiBold">
              {progress}%
            </Text>
          </View>
          <Progress value={progress} />
        </View>
        <View style={styles.progressItem}>
          <Text size="sm">Success</Text>
          <Progress value={100} variant="success" />
        </View>
        <View style={styles.progressItem}>
          <Text size="sm">Warning</Text>
          <Progress value={60} variant="warning" />
        </View>
        <View style={styles.progressItem}>
          <Text size="sm">Error</Text>
          <Progress value={25} variant="error" />
        </View>
        <View style={styles.progressItem}>
          <Text size="sm">Indeterminate (Loading)</Text>
          <Progress indeterminate />
        </View>
        <Button
          text="Increase Progress"
          size="sm"
          variant="secondary"
          onPress={incrementProgress}
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Skeleton Section */}
      <Section title="Skeleton Loaders">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Shimmer animation for loading states
        </Text>
        <View style={styles.skeletonDemo}>
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonHeader}>
              <Skeleton variant="circular" width={48} height={48} />
              <View style={styles.skeletonHeaderText}>
                <Skeleton variant="text" width="60%" height={16} />
                <Skeleton variant="text" width="40%" height={12} />
              </View>
            </View>
            <Skeleton variant="rectangular" width="100%" height={120} />
            <SkeletonGroup gap={8}>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="60%" />
            </SkeletonGroup>
          </View>
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Animated Cards Section */}
      <Section title="Animated Cards">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Entrance animations with press interactions
        </Text>
        <View style={styles.animatedCardsGrid}>
          <AnimatedCard entering="fadeInUp" delay={0} onPress={() => {}}>
            <Text weight="semiBold">Fade In Up</Text>
            <Text size="sm" color="secondary">
              Tap for feedback
            </Text>
          </AnimatedCard>
          <AnimatedCard entering="zoomIn" delay={ANIMATION.STAGGER_DELAY} onPress={() => {}}>
            <Text weight="semiBold">Zoom In</Text>
            <Text size="sm" color="secondary">
              Tap for feedback
            </Text>
          </AnimatedCard>
          <AnimatedCard
            entering="slideInLeft"
            delay={ANIMATION.STAGGER_DELAY * 2}
            tiltEffect
            onPress={() => {}}
          >
            <Text weight="semiBold">Slide In + Tilt</Text>
            <Text size="sm" color="secondary">
              Drag for 3D tilt
            </Text>
          </AnimatedCard>
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Text Fields Section */}
      <Section title="Text Fields">
        <TextField
          label="Default Input"
          placeholder="Enter text..."
          value={inputValue}
          onChangeText={setInputValue}
        />
        <TextField
          label="With Helper"
          placeholder="Enter email..."
          helper="We'll never share your email"
        />
        <TextField
          label="Error State"
          placeholder="Enter password..."
          status="error"
          helper="Password is required"
        />
        <TextField
          label="Success State"
          placeholder="Verified"
          status="success"
          value="user@example.com"
        />
        <TextField
          label="Disabled"
          placeholder="Cannot edit"
          status="disabled"
          value="Disabled input"
        />
        <TextField
          label="Multiline"
          placeholder="Enter description..."
          multiline
          numberOfLines={4}
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Cards Section */}
      <Section title="Cards">
        <Card
          heading="Default Card"
          content="This is the default card style with a border"
          footer="Footer text"
        />
        <Card
          preset="elevated"
          heading="Elevated Card"
          content="This card has a shadow for elevation"
          footer="With shadow"
        />
        <Card
          preset="outlined"
          heading="Outlined Card"
          content="This card only has an outline border"
        />
        <Card
          heading="Pressable Card"
          content="Tap me to see interaction"
          onPress={() => console.log("Card pressed")}
          RightComponent={
            <View style={styles.cardIcon}>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.foreground} />
            </View>
          }
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* List Items Section */}
      <Section title="List Items">
        <View style={styles.listContainer}>
          <ListItem text="Default List Item" bottomSeparator />
          <ListItem
            text="With Left Icon"
            LeftComponent={
              <View style={styles.listIconBox}>
                <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.foreground} />
              </View>
            }
            bottomSeparator
          />
          <ListItem
            text="With Right Chevron"
            RightComponent={
              <Ionicons name="chevron-forward" size={20} color={theme.colors.foregroundSecondary} />
            }
            bottomSeparator
          />
          <ListItem text="Tappable Item" onPress={() => console.log("Item pressed")} />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Empty State Section */}
      <Section title="Empty State">
        <EmptyState
          preset="generic"
          heading="No Items Found"
          content="You haven't added any items yet. Start by creating your first one."
          button="Create Item"
          buttonOnPress={() => console.log("Create pressed")}
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Avatars Section */}
      <Section title="Avatars">
        <View style={styles.avatarRow}>
          <Avatar fallback="XS" size="xs" />
          <Avatar fallback="SM" size="sm" />
          <Avatar fallback="MD" size="md" />
          <Avatar fallback="LG" size="lg" />
          <Avatar fallback="XL" size="xl" />
        </View>
        <View style={styles.avatarRow}>
          <Avatar fallback="JD" shape="circle" />
          <Avatar fallback="AB" shape="rounded" />
          <Avatar fallback="CD" shape="square" />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Badges Section */}
      <Section title="Badges">
        <View style={styles.badgeRow}>
          <Badge text="Default" />
          <Badge text="Primary" variant="primary" />
          <Badge text="Secondary" variant="secondary" />
        </View>
        <View style={styles.badgeRow}>
          <Badge text="Success" variant="success" />
          <Badge text="Error" variant="error" />
          <Badge text="Warning" variant="warning" />
          <Badge text="Info" variant="info" />
        </View>
        <View style={styles.badgeRow}>
          <Badge text="Small" size="sm" />
          <Badge text="Medium" size="md" />
          <Badge text="Large" size="lg" />
        </View>
        <View style={styles.badgeRow}>
          <Badge dot variant="default" />
          <Badge dot variant="error" />
          <Badge dot variant="success" />
          <Badge dot variant="warning" size="lg" />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Dividers Section */}
      <Section title="Dividers">
        <Text size="sm" color="secondary" style={styles.dividerLabel}>
          Horizontal (thin)
        </Text>
        <Divider size="thin" />
        <Text size="sm" color="secondary" style={styles.dividerLabel}>
          Horizontal (default)
        </Text>
        <Divider />
        <Text size="sm" color="secondary" style={styles.dividerLabel}>
          Horizontal (thick)
        </Text>
        <Divider size="thick" />
        <Text size="sm" color="secondary" style={styles.dividerLabel}>
          With label
        </Text>
        <Divider label="OR" />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Spinners Section */}
      <Section title="Spinners">
        <View style={styles.spinnerRow}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </View>
        <Spinner text="Loading data..." />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Color Palette Section */}
      <Section title="Color Palette">
        <View style={styles.colorGrid}>
          <ColorSwatch color={theme.colors.primary} name="Primary" />
          <ColorSwatch color={theme.colors.secondary} name="Secondary" />
          <ColorSwatch color={theme.colors.accent} name="Accent" />
          <ColorSwatch color={theme.colors.success} name="Success" />
          <ColorSwatch color={theme.colors.error} name="Error" />
          <ColorSwatch color={theme.colors.warning} name="Warning" />
          <ColorSwatch color={theme.colors.info} name="Info" />
          <ColorSwatch color={theme.colors.background} name="Background" border />
          <ColorSwatch color={theme.colors.card} name="Card" border />
          <ColorSwatch color={theme.colors.foreground} name="Foreground" />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Charts Section */}
      <Section title="Charts">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Animated charts with SVG rendering
        </Text>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Line Chart:
        </Text>
        <View style={styles.chartContainer}>
          <LineChart
            labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
            datasets={[
              {
                id: "revenue",
                label: "Revenue",
                data: [30, 45, 28, 80, 65, 95],
                color: theme.colors.primary,
              },
              {
                id: "expenses",
                label: "Expenses",
                data: [20, 35, 40, 50, 45, 60],
                color: theme.colors.error,
              },
            ]}
            height={200}
            showLegend
            showDots
            fillArea
          />
        </View>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Bar Chart:
        </Text>
        <View style={styles.chartContainer}>
          <BarChart
            data={[
              { label: "Mon", value: 40 },
              { label: "Tue", value: 65 },
              { label: "Wed", value: 55 },
              { label: "Thu", value: 80 },
              { label: "Fri", value: 70 },
            ]}
            height={200}
            showValues
            barColor={theme.colors.primary}
          />
        </View>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Pie Chart (Donut):
        </Text>
        <View style={styles.chartContainer}>
          <PieChart
            data={[
              { label: "Desktop", value: 45, color: theme.colors.primary },
              { label: "Mobile", value: 35, color: theme.colors.success },
              { label: "Tablet", value: 20, color: theme.colors.warning },
            ]}
            height={200}
            innerRadius={0.6}
            showPercentage
            showLegend
          />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Toggle Controls Section */}
      <Section title="Toggle Controls">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Switch, Checkbox, and Radio components with animations
        </Text>

        <View style={styles.toggleRow}>
          <Switch value={switchValue} onValueChange={setSwitchValue} label="Enable notifications" />
        </View>

        <View style={styles.toggleRow}>
          <Switch
            value={!switchValue}
            onValueChange={(val) => setSwitchValue(!val)}
            label="Dark mode"
            accessibilityMode="icon"
          />
        </View>

        <View style={styles.toggleRow}>
          <Checkbox
            value={checkboxValue}
            onValueChange={setCheckboxValue}
            label="I agree to the terms and conditions"
          />
        </View>

        <View style={styles.toggleRow}>
          <Checkbox
            value={!checkboxValue}
            onValueChange={(val) => setCheckboxValue(!val)}
            label="Subscribe to newsletter"
          />
        </View>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Radio Group:
        </Text>
        <View style={styles.radioGroup}>
          <Radio
            value={radioValue === "option1"}
            onValueChange={() => setRadioValue("option1")}
            label="Option 1"
          />
          <Radio
            value={radioValue === "option2"}
            onValueChange={() => setRadioValue("option2")}
            label="Option 2"
          />
          <Radio
            value={radioValue === "option3"}
            onValueChange={() => setRadioValue("option3")}
            label="Option 3"
          />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Date & File Pickers Section */}
      <Section title="Date & File Pickers">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Native-feeling pickers with calendar and file selection
        </Text>

        <DatePicker
          label="Select Date"
          value={selectedDate}
          onChange={setSelectedDate}
          placeholder="Choose a date..."
          helper="Pick any date from the calendar"
        />

        <DatePicker
          label="Select Date & Time"
          mode="datetime"
          value={selectedDate}
          onChange={setSelectedDate}
          placeholder="Choose date and time..."
        />

        <FilePicker
          label="Upload Image"
          fileType="image"
          value={selectedFiles}
          onChange={setSelectedFiles}
          placeholder="Tap to select an image"
          helper="PNG, JPG up to 10MB"
        />

        <FilePicker
          label="Upload Documents"
          fileType="document"
          value={selectedDocuments}
          onChange={setSelectedDocuments}
          placeholder="Tap to select documents"
          multiple
          maxFiles={5}
          helper="PDF, DOC, XLS up to 10MB each"
        />
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Modals Section */}
      <Section title="Modals">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Flexible modal dialogs with animations
        </Text>

        <View style={styles.buttonRow}>
          <Button text="Open Modal" variant="outlined" onPress={onOpenModal} />
          <Button text="Alert Modal" variant="danger" onPress={onOpenAlertModal} />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Toast Notifications Section */}
      <Section title="Toast Notifications">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Non-blocking notifications with auto-dismiss. Requires ToastProvider wrapper.
        </Text>

        <View style={styles.toastInfoCard}>
          <Text size="sm" weight="semiBold">
            Usage Example:
          </Text>
          <Text size="xs" color="secondary" style={styles.codeBlock}>
            {`const toast = useToast()\n\ntoast.show({\n  title: "Success!",\n  description: "Your changes saved",\n  variant: "success", // success | error | warning | info\n})`}
          </Text>
        </View>

        <Text size="sm" color="secondary">
          Variants: default, success, error, warning, info
        </Text>
        <View style={styles.badgeRow}>
          <Badge text="Success" variant="success" />
          <Badge text="Error" variant="error" />
          <Badge text="Warning" variant="warning" />
          <Badge text="Info" variant="info" />
        </View>

        <Text size="sm" color="secondary" style={styles.marginTop8}>
          Features: Auto-dismiss with progress bar, action buttons, stacking, swipe to dismiss
        </Text>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Skeleton Presets Section */}
      <Section title="Skeleton Presets">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Pre-built skeleton layouts for common patterns
        </Text>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Card Skeleton:
        </Text>
        <SkeletonCard />

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          List Item Skeleton:
        </Text>
        <View style={styles.skeletonListContainer}>
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem showAvatar={false} />
        </View>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Paragraph Skeleton:
        </Text>
        <View style={styles.skeletonParagraphContainer}>
          <SkeletonParagraph lines={4} />
        </View>
      </Section>

      <Divider style={styles.sectionDivider} />

      {/* Business Components Section */}
      <Section title="Business Components">
        <Text size="sm" color="secondary" style={styles.sectionDescription}>
          Pre-built components for common business use cases
        </Text>

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Subscription Status:
        </Text>
        <SubscriptionStatus isPro={false} />

        <View style={styles.height12} />

        <SubscriptionStatus
          isPro={true}
          platform="mock"
          expirationDate="2025-12-31"
          willRenew={true}
        />

        <Text size="sm" weight="medium" style={styles.variantLabel}>
          Pricing Card:
        </Text>
        <PricingCard
          title="Pro Plan"
          price="$9.99"
          description="Perfect for power users"
          billingPeriod="month"
          features={[
            "Unlimited projects",
            "Priority support",
            "Advanced analytics",
            "Custom integrations",
          ]}
          isPopular
          onPress={() => console.log("Subscribe pressed")}
        />

        <PricingCard
          title="Basic Plan"
          price="$4.99"
          description="Great for getting started"
          billingPeriod="month"
          features={["5 projects", "Email support", "Basic analytics"]}
          onPress={() => console.log("Subscribe pressed")}
        />
      </Section>

      <View style={styles.footer}>
        <Text size="sm" color="tertiary" style={styles.footerText}>
          All components are styled with Unistyles 3.0
        </Text>
        <Text size="sm" color="tertiary" style={styles.footerText}>
          With haptics and microanimations
        </Text>
        <Text size="sm" color="tertiary" style={styles.footerText}>
          Theme: {UnistylesRuntime.themeName}
        </Text>
      </View>
    </View>
  )
})

// =============================================================================
// COMPONENT
// =============================================================================

export const ComponentShowcaseScreen: FC<ComponentShowcaseScreenProps> =
  function ComponentShowcaseScreen(_props) {
    const { navigation } = _props
    const { theme } = useUnistyles()
    const insets = useSafeAreaInsets()
    const { width: windowWidth } = useWindowDimensions()

    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState(65)
    const [activeTab, setActiveTab] = useState("overview")

    // Toggle controls state
    const [switchValue, setSwitchValue] = useState(false)
    const [checkboxValue, setCheckboxValue] = useState(false)
    const [radioValue, setRadioValue] = useState<string>("option1")

    // Form inputs state
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [selectedFiles, setSelectedFiles] = useState<
      Array<{ uri: string; name: string; type: string; size?: number }>
    >([])
    const [selectedDocuments, setSelectedDocuments] = useState<
      Array<{ uri: string; name: string; type: string; size?: number }>
    >([])

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [showAlertModal, setShowAlertModal] = useState(false)

    const isLargeScreen = windowWidth > 768
    const contentStyle = isLargeScreen
      ? {
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: "center" as const,
          width: webDimension("100%"),
        }
      : {}

    const toggleTheme = () => {
      const newTheme = UnistylesRuntime.themeName === "dark" ? "light" : "dark"
      UnistylesRuntime.setTheme(newTheme)
    }

    const simulateLoading = useCallback(() => {
      setIsLoading(true)
      setTimeout(() => setIsLoading(false), 2000)
    }, [])

    const incrementProgress = useCallback(() => {
      setProgress((prev) => Math.min(prev + 10, 100))
    }, [])

    const handleOpenModal = useCallback(() => setShowModal(true), [])
    const handleOpenAlertModal = useCallback(() => setShowAlertModal(true), [])

    return (
      <Container safeAreaEdges={["top"]}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
          <View style={styles.headerLeft}>
            <IconButton icon="arrow-back" variant="ghost" onPress={() => navigation.goBack()} />
            <Text size="2xl" weight="bold">
              Components
            </Text>
          </View>
          <View style={styles.themeToggle}>
            <Ionicons
              name={UnistylesRuntime.themeName === "dark" ? "moon" : "sunny"}
              size={18}
              color={theme.colors.foregroundSecondary}
            />
            <RNSwitch
              value={UnistylesRuntime.themeName === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.colors.border, true: theme.colors.tint }}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            contentStyle,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ShowcaseContent
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            simulateLoading={simulateLoading}
            progress={progress}
            incrementProgress={incrementProgress}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            switchValue={switchValue}
            setSwitchValue={setSwitchValue}
            checkboxValue={checkboxValue}
            setCheckboxValue={setCheckboxValue}
            radioValue={radioValue}
            setRadioValue={setRadioValue}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            selectedDocuments={selectedDocuments}
            setSelectedDocuments={setSelectedDocuments}
            onOpenModal={handleOpenModal}
            onOpenAlertModal={handleOpenAlertModal}
          />
        </ScrollView>

        {/* Modals rendered conditionally outside ScrollView for performance */}
        {showModal && (
          <Modal
            visible={showModal}
            onClose={() => setShowModal(false)}
            title="Example Modal"
            description="This is a flexible modal component with header, content, and footer sections."
            primaryAction="Confirm"
            onPrimaryAction={() => setShowModal(false)}
            secondaryAction="Cancel"
            onSecondaryAction={() => setShowModal(false)}
          >
            <View style={styles.modalDemoContent}>
              <Text>
                You can put any content here. The modal supports scrolling for longer content.
              </Text>
            </View>
          </Modal>
        )}

        {showAlertModal && (
          <AlertModal
            visible={showAlertModal}
            onClose={() => setShowAlertModal(false)}
            title="Delete Item?"
            message="This action cannot be undone. Are you sure you want to delete this item?"
            confirmText="Delete"
            cancelText="Cancel"
            onConfirm={() => setShowAlertModal(false)}
            variant="danger"
          />
        )}
      </Container>
    )
  }

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text size="lg" weight="bold" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  )
}

interface ColorSwatchProps {
  color: string
  name: string
  border?: boolean
}

function ColorSwatch({ color, name, border }: ColorSwatchProps) {
  const { theme } = useUnistyles()
  return (
    <View style={styles.colorSwatch}>
      <View
        style={[
          styles.colorBox,
          { backgroundColor: color },
          border && [styles.colorBoxWithBorder, { borderColor: theme.colors.border }],
        ]}
      />
      <Text size="xs" color="secondary">
        {name}
      </Text>
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
    // Enable mouse wheel scrolling on web
    ...(Platform.OS === "web" && {
      overflowY: "auto" as unknown as "scroll",
    }),
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  contentContainer: {
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    color: theme.colors.foreground,
  },
  sectionDescription: {
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.xs,
  },
  sectionContent: {
    gap: theme.spacing.md,
  },
  sectionDivider: {
    marginVertical: theme.spacing.lg,
  },
  variantLabel: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  iconButtonRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
  },
  tabContent: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  progressItem: {
    gap: theme.spacing.xs,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonDemo: {
    gap: theme.spacing.md,
  },
  skeletonCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  animatedCardsGrid: {
    gap: theme.spacing.md,
  },
  marginTop8: {
    marginTop: 8,
  },
  height12: {
    height: 12,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  dividerLabel: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xl,
  },
  cardIcon: {
    alignSelf: "center",
    padding: theme.spacing.sm,
  },
  listContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  listIconBox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  colorSwatch: {
    alignItems: "center",
    gap: theme.spacing.xxs,
  },
  colorBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
  },
  colorBoxWithBorder: {
    borderWidth: 1,
  },
  // Chart styles
  chartContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  // Toggle control styles
  toggleRow: {
    marginVertical: theme.spacing.xs,
  },
  radioGroup: {
    gap: theme.spacing.sm,
  },
  // Modal styles
  modalDemoContent: {
    paddingVertical: theme.spacing.md,
  },
  // Skeleton preset styles
  skeletonListContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  skeletonParagraphContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  // Toast info styles
  toastInfoCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  codeBlock: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  footer: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xxs,
  },
  footerText: {
    textAlign: "center",
  },
}))
