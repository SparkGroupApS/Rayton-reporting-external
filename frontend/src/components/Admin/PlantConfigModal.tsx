import { PlantPublic, useUpdatePlant } from "@/hooks/usePlantQueries";
import {
    Button,
    DialogActionTrigger,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogTitle,
    Field,
    Input,
    Text,
    Textarea,
    VStack,
} from "@chakra-ui/react";
import { useState } from "react";

interface PlantConfigModalProps {
  plant: PlantPublic;
  isOpen: boolean;
  onClose: () => void;
}

export const PlantConfigModal = ({ plant, isOpen, onClose }: PlantConfigModalProps) => {
  const [config, setConfig] = useState<string>(plant.tab_config || "");
  const updatePlantMutation = useUpdatePlant();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    // Validate JSON if provided
    if (config.trim() !== "") {
      try {
        JSON.parse(config);
      } catch (error) {
        alert("Invalid JSON format for tab configuration");
        return;
      }
    }

    updatePlantMutation.mutate(
      { plantId: plant.PLANT_ID, plantData: { tab_config: config } },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleOpenChange = ({ open }: { open: boolean }) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <DialogRoot size={{ base: "xs", md: "lg" }} placement="center" open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Configure Plant Tabs</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Configure tab variations for plant {plant.PLANT_ID}.</Text>
            <VStack gap={4}>
              <Field.Root id="plant-id-display">
                <Field.Label>Plant ID</Field.Label>
                <Input
                  value={plant.PLANT_ID}
                  disabled
                />
              </Field.Root>

              <Field.Root id="tab-config-field">
                <Field.Label>Tab Configuration (JSON)</Field.Label>
                <Textarea
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  placeholder={`{ "dashboard_tabs": ["overview", "consumption", "production"], "show_consumption_graph": true }`}
                  rows={8}
                />
              </Field.Root>

              <Text fontSize="sm" color="gray.500">
                Enter valid JSON configuration for tab variations. This allows customizing the dashboard for this specific plant.
              </Text>
            </VStack>

            {updatePlantMutation.isError && (
              <Text color="red.500" fontSize="sm" mt={2}>
                Error:{" "}
                {updatePlantMutation.error instanceof Error
                  ? updatePlantMutation.error.message
                  : "Failed to update plant configuration"}
              </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                type="button"
                onClick={onClose}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="rayton_orange"
              type="submit"
              disabled={updatePlantMutation.isPending}
              loading={updatePlantMutation.isPending}
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
