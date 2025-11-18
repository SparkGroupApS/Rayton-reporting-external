import { Container, Heading } from "@chakra-ui/react"
import { useTheme } from "next-themes"


const Appearance = () => {
  const { theme, setTheme } = useTheme()

  return (
    <Container maxW="full">
      <Heading size="sm" py={4}>
        Appearance
      </Heading>

      {/* <RadioGroup
        onValueChange={(e) => setTheme(e.value ?? "system")}
        value={theme}
        colorPalette="rayton_orange"
      >
        <Stack>
          <Radio value="system">System</Radio>
          <Radio value="light">Light Mode</Radio>
          <Radio value="dark">Dark Mode</Radio>
        </Stack>
      </RadioGroup> */}
    </Container>
  )
}
export default Appearance
