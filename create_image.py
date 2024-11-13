from PIL import Image

# Create a blank image (100x100 pixels) with a red background
image = Image.new("RGB", (100, 100), color="red")
image.save("image.png")

