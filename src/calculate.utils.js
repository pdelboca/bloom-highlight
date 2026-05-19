export function getRx(height, tip, paddingY) {
  return tip === "round" ? (height + paddingY) / 2 : 1
}

export function getRectSize(width, height, paddingX, paddingY) {
  return {
    width: width + paddingX * 2,
    height: height + paddingY * 2,
  }
}
