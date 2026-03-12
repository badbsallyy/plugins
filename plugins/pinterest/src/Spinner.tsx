import cx from "classnames"
import styles from "./spinner.module.css"

export interface SpinnerProps {
    size?: "normal" | "medium" | "large"
    inline?: boolean
    className?: string
    inheritColor?: boolean
}

function styleForSize(size: SpinnerProps["size"]) {
    switch (size) {
        case "normal": return styles.normalStyle
        case "medium": return styles.mediumStyle
        case "large": return styles.largeStyle
    }
}

function spinnerClassNames(size: SpinnerProps["size"] = "normal") {
    return cx(styles.spin, styles.baseStyle, styleForSize(size))
}

export const Spinner = ({ size, inline = false, inheritColor, className, ...rest }: SpinnerProps) => {
    return (
        <div
            className={cx(
                className,
                spinnerClassNames(size),
                inheritColor && styles.buttonWithDepthSpinner,
                !inline && styles.centeredStyle
            )}
            {...rest}
        />
    )
}
