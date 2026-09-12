from PIL import Image
frames = [Image.open(f"reports/doc-media-audit/frame-{i}.png").convert("RGB") for i in range(5)]
frames[0].save("docs/assets/finch-editing-demo.gif", save_all=True, append_images=frames[1:], duration=1800, loop=0)
